import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MealLedgerEntry } from '../entities/meal-ledger-entry.entity';
import { LedgerEntryType } from '@saunf/shared';

export interface CustomerBalance {
  customerId: string;
  totalMealBalance: number;
  carryoverBalance: number;
  mealsRemaining: number;
}

export interface CreateLedgerEntryDto {
  customerId: string;
  subscriptionId?: string;
  entryType: LedgerEntryType;
  meals: number;
  amountPaise?: number;
  referenceId?: string;
  referenceType?: string;
  note?: string;
  createdBy?: string;
}

/**
 * The Ledger Service is the only code path that writes to meal_ledger.
 *
 * Design principles:
 * - Append-only: rows are never updated or deleted.
 * - Corrections use REVERSAL entries, not mutations.
 * - Balances are always computed from entries, never cached.
 */
@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(MealLedgerEntry)
    private readonly ledgerRepo: Repository<MealLedgerEntry>,
  ) {}

  private getLedgerRepo(
    manager?: EntityManager,
  ): Repository<MealLedgerEntry> {
    return manager?.getRepository(MealLedgerEntry) ?? this.ledgerRepo;
  }

  /**
   * Append a new entry to the ledger. This is a single atomic insert.
   */
  async createEntry(
    dto: CreateLedgerEntryDto,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    const ledgerRepo = this.getLedgerRepo(manager);
    const entry = ledgerRepo.create({
      customerId: dto.customerId,
      subscriptionId: dto.subscriptionId || null,
      entryType: dto.entryType,
      meals: dto.meals,
      amountPaise: dto.amountPaise ?? 0,
      referenceId: dto.referenceId || null,
      referenceType: dto.referenceType || null,
      note: dto.note || null,
      createdBy: dto.createdBy || null,
    });

    return ledgerRepo.save(entry);
  }

  /**
   * Credit meals when a plan is activated or renewed.
   */
  async creditPlan(
    customerId: string,
    subscriptionId: string,
    meals: number,
    amountPaise: number,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    return this.createEntry(
      {
        customerId,
        subscriptionId,
        entryType: LedgerEntryType.PLAN_CREDIT,
        meals,
        amountPaise,
        referenceType: 'subscription',
        referenceId: subscriptionId,
        note: `Plan activated: ${meals} meals credited`,
      },
      manager,
    );
  }

  /**
   * Debit one meal when a customer is marked Present.
   */
  async consumeMeal(
    customerId: string,
    subscriptionId: string,
    mealSelectionId: string,
    perMealPaise: number,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    return this.createEntry(
      {
        customerId,
        subscriptionId,
        entryType: LedgerEntryType.MEAL_CONSUMED,
        meals: -1,
        amountPaise: -perMealPaise,
        referenceType: 'meal_selection',
        referenceId: mealSelectionId,
      },
      manager,
    );
  }

  /**
   * Credit one carry-over meal when a customer is marked Absent.
   */
  async creditCarryover(
    customerId: string,
    subscriptionId: string,
    mealSelectionId: string,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    return this.createEntry(
      {
        customerId,
        subscriptionId,
        entryType: LedgerEntryType.CARRYOVER_CREDIT,
        meals: 1,
        referenceType: 'meal_selection',
        referenceId: mealSelectionId,
        note: 'Absent - meal carried over to next month',
      },
      manager,
    );
  }

  /**
   * Apply carry-over meals as a discount on an invoice.
   */
  async applyCarryover(
    customerId: string,
    subscriptionId: string,
    invoiceId: string,
    meals: number,
    discountPaise: number,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    return this.createEntry(
      {
        customerId,
        subscriptionId,
        entryType: LedgerEntryType.CARRYOVER_APPLIED,
        meals: -meals,
        amountPaise: -discountPaise,
        referenceType: 'invoice',
        referenceId: invoiceId,
        note: `${meals} carry-over meals applied to invoice`,
      },
      manager,
    );
  }

  /**
   * Write a reversal entry to undo a previous entry.
   */
  async reverseEntry(
    originalEntry: MealLedgerEntry,
    reason: string,
    reversedBy: string,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    return this.createEntry(
      {
        customerId: originalEntry.customerId,
        subscriptionId: originalEntry.subscriptionId || undefined,
        entryType: LedgerEntryType.REVERSAL,
        meals: -originalEntry.meals,
        amountPaise: -originalEntry.amountPaise,
        referenceType: 'reversal',
        referenceId: originalEntry.id,
        note: `Reversal of ${originalEntry.entryType}: ${reason}`,
        createdBy: reversedBy,
      },
      manager,
    );
  }

  /**
   * Manual adjustment by the owner. Requires a reason.
   */
  async manualAdjustment(
    customerId: string,
    meals: number,
    amountPaise: number,
    reason: string,
    adjustedBy: string,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A reason is required for manual ledger adjustments');
    }

    return this.createEntry(
      {
        customerId,
        entryType: LedgerEntryType.ADJUSTMENT,
        meals,
        amountPaise,
        note: reason,
        createdBy: adjustedBy,
      },
      manager,
    );
  }

  /**
   * Compute the current balance for a customer from the ledger.
   */
  async getBalance(customerId: string): Promise<CustomerBalance> {
    const result = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.customer_id', 'customerId')
      .addSelect('COALESCE(SUM(l.meals), 0)', 'totalMealBalance')
      .addSelect(
        `COALESCE(SUM(CASE WHEN l.entry_type = 'CARRYOVER_CREDIT' THEN l.meals ELSE 0 END), 0)
         + COALESCE(SUM(CASE WHEN l.entry_type = 'CARRYOVER_APPLIED' THEN l.meals ELSE 0 END), 0)`,
        'carryoverBalance',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN l.entry_type = 'PLAN_CREDIT' THEN l.meals ELSE 0 END), 0)
         + COALESCE(SUM(CASE WHEN l.entry_type = 'MEAL_CONSUMED' THEN l.meals ELSE 0 END), 0)`,
        'mealsRemaining',
      )
      .where('l.customer_id = :customerId', { customerId })
      .groupBy('l.customer_id')
      .getRawOne();

    if (!result) {
      return {
        customerId,
        totalMealBalance: 0,
        carryoverBalance: 0,
        mealsRemaining: 0,
      };
    }

    return {
      customerId: result.customerId,
      totalMealBalance: parseInt(result.totalMealBalance, 10),
      carryoverBalance: parseInt(result.carryoverBalance, 10),
      mealsRemaining: parseInt(result.mealsRemaining, 10),
    };
  }

  /**
   * Get all ledger entries for a customer, ordered chronologically.
   */
  async getHistory(customerId: string): Promise<MealLedgerEntry[]> {
    return this.ledgerRepo.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find the newest ledger entry linked to a specific domain object.
   */
  async findByReference(
    referenceType: string,
    referenceId: string,
    manager?: EntityManager,
  ): Promise<MealLedgerEntry | null> {
    const ledgerRepo = this.getLedgerRepo(manager);
    return ledgerRepo.findOne({
      where: { referenceType, referenceId },
      order: { createdAt: 'DESC' },
    });
  }
}
