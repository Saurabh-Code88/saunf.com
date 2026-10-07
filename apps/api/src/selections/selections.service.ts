import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { MealSelection } from '../entities/meal-selection.entity';
import { SelectionAudit } from '../entities/selection-audit.entity';
import { DailyMenu } from '../entities/daily-menu.entity';
import { Subscription } from '../entities/subscription.entity';
import { LedgerService } from '../ledger/ledger.service';
import {
  MealSelectionState,
  SelectionSource,
  ALLOWED_TRANSITIONS,
} from '@saunf/shared';

export interface ResolveSelectionDto {
  selectionId: string;
  newState: MealSelectionState;
  menuItemId?: string;
  source: SelectionSource;
  actorId?: string;
  actorType?: 'customer' | 'admin';
  reason?: string;
}

export interface KitchenCount {
  menuDate: string;
  dishes: { menuItemId: string; name: string; count: number }[];
  absentCount: number;
  pendingCount: number;
  totalCustomers: number;
}

/**
 * Manages the meal selection state machine.
 *
 * State transitions:
 *   PENDING → PRESENT (customer votes or owner confirms)
 *   PENDING → ABSENT  (customer picks absent or owner confirms)
 *   PRESENT → ABSENT  (correction by owner, with reason)
 *   ABSENT  → PRESENT (correction by owner, with reason)
 *   PRESENT/ABSENT → PENDING (only for corrections, reverting to unresolved)
 *
 * Each transition:
 * 1. Validates the transition is allowed
 * 2. Checks cutoff (customers can't change after cutoff)
 * 3. Updates the selection
 * 4. Creates an audit record
 * 5. Writes the appropriate ledger entry (or reverses one for corrections)
 */
@Injectable()
export class SelectionsService {
  constructor(
    @InjectRepository(MealSelection)
    private readonly selectionRepo: Repository<MealSelection>,
    @InjectRepository(SelectionAudit)
    private readonly auditRepo: Repository<SelectionAudit>,
    @InjectRepository(DailyMenu)
    private readonly dailyMenuRepo: Repository<DailyMenu>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create PENDING selections for all active customers for a given daily menu.
   * Called when the daily menu is finalized / WhatsApp messages are sent.
   */
  async createPendingForAllCustomers(
    dailyMenuId: string,
    menuDate: string,
    customerIds: string[],
  ): Promise<MealSelection[]> {
    if (customerIds.length === 0) {
      return [];
    }

    const selections = customerIds.map((customerId) =>
      this.selectionRepo.create({
        customerId,
        dailyMenuId,
        menuDate,
        state: MealSelectionState.PENDING,
        source: SelectionSource.SYSTEM,
      }),
    );

    await this.selectionRepo
      .createQueryBuilder()
      .insert()
      .into(MealSelection)
      .values(selections)
      .orIgnore()
      .execute();

    return this.selectionRepo.find({
      where: {
        customerId: In(customerIds),
        menuDate,
      },
      order: { customerId: 'ASC' },
    });
  }

  /**
   * Resolve a meal selection — the core state machine transition.
   * Runs in a transaction to keep selection, audit, and ledger in sync.
   */
  async resolve(dto: ResolveSelectionDto): Promise<MealSelection> {
    return this.dataSource.transaction(async (manager) => {
      const selectionRepo = manager.getRepository(MealSelection);
      const auditRepo = manager.getRepository(SelectionAudit);

      // 1. Load the current selection (with lock to prevent race conditions)
      const selection = await selectionRepo.findOne({
        where: { id: dto.selectionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!selection) {
        throw new NotFoundException(`Selection ${dto.selectionId} not found`);
      }

      const currentState = selection.state as MealSelectionState;
      const newState = dto.newState;

      // 2. Validate the transition
      if (!ALLOWED_TRANSITIONS[currentState]?.includes(newState)) {
        throw new BadRequestException(
          `Cannot transition from ${currentState} to ${newState}`,
        );
      }

      // 3. If it's a customer action, check cutoff
      if (
        dto.source === SelectionSource.CUSTOMER_VOTE ||
        dto.source === SelectionSource.CUSTOMER_WEB
      ) {
        const dailyMenu = await manager.getRepository(DailyMenu).findOne({
          where: { id: selection.dailyMenuId },
        });

        if (dailyMenu?.isLocked) {
          throw new ForbiddenException(
            'Voting is closed for this day. Contact the owner to make changes.',
          );
        }

        if (dailyMenu?.cutoffTime && new Date() > dailyMenu.cutoffTime) {
          throw new ForbiddenException(
            'The cutoff time has passed. Contact the owner to make changes.',
          );
        }
      }

      // 4. Require a reason for owner corrections on already-resolved days
      if (
        dto.source === SelectionSource.OWNER &&
        currentState !== MealSelectionState.PENDING &&
        (!dto.reason || dto.reason.trim().length === 0)
      ) {
        throw new BadRequestException(
          'A reason is required when correcting a previously resolved day',
        );
      }

      // 5. If PRESENT, a dish must be selected
      if (newState === MealSelectionState.PRESENT && !dto.menuItemId) {
        throw new BadRequestException(
          'A dish must be selected when marking a customer as Present',
        );
      }

      // 6. Save the previous state for audit
      const previousState = selection.state;
      const previousItemId = selection.menuItemId;

      // 7. Update the selection
      selection.state = newState;
      selection.menuItemId =
        newState === MealSelectionState.PRESENT ? dto.menuItemId! : null;
      selection.source = dto.source;
      selection.resolvedAt =
        newState === MealSelectionState.PENDING ? null : new Date();
      selection.resolvedBy =
        newState !== MealSelectionState.PENDING && dto.actorType === 'admin'
          ? dto.actorId || null
          : null;
      selection.note = dto.reason || null;

      await selectionRepo.save(selection);

      // 8. Create audit record
      const audit = auditRepo.create({
        mealSelectionId: selection.id,
        previousState: previousState as string,
        newState: newState as string,
        previousItemId,
        newItemId: selection.menuItemId,
        source: dto.source,
        actorId: dto.actorId || null,
        actorType: dto.actorType || null,
        reason: dto.reason || null,
      });

      await auditRepo.save(audit);

      // 9. Handle ledger effects
      await this.handleLedgerEffects(
        selection,
        previousState as MealSelectionState,
        newState,
        dto,
        manager,
      );

      return selection;
    });
  }

  /**
   * Handle ledger entries for a state transition.
   * - PENDING → PRESENT: debit 1 meal (MEAL_CONSUMED)
   * - PENDING → ABSENT: credit 1 carry-over (CARRYOVER_CREDIT)
   * - Corrections (PRESENT→ABSENT, ABSENT→PRESENT): reverse old entry, write new one
   */
  private async handleLedgerEffects(
    selection: MealSelection,
    previousState: MealSelectionState,
    newState: MealSelectionState,
    dto: ResolveSelectionDto,
    manager: EntityManager,
  ): Promise<void> {
    // Find the customer's active subscription for ledger context
    const subscription = await manager.getRepository(Subscription).findOne({
      where: { customerId: selection.customerId, status: 'ACTIVE' },
      relations: ['plan'],
    });

    if (!subscription) return; // No active subscription, skip ledger

    const subscriptionId = subscription.id;

    // If correcting a previously resolved state, reverse the old entry first
    if (previousState !== MealSelectionState.PENDING) {
      const oldEntry = await this.ledgerService.findByReference(
        'meal_selection',
        selection.id,
        manager,
      );

      if (oldEntry) {
        await this.ledgerService.reverseEntry(
          oldEntry,
          dto.reason || 'State correction',
          dto.actorId || 'system',
          manager,
        );
      }
    }

    // Write the new ledger entry
    if (newState === MealSelectionState.PRESENT) {
      const plan = subscription.plan;
      const perMealPaise = plan
        ? Math.round(plan.pricePaise / plan.mealsPerMonth)
        : 0;

      await this.ledgerService.consumeMeal(
        selection.customerId,
        subscriptionId,
        selection.id,
        perMealPaise,
        manager,
      );
    } else if (newState === MealSelectionState.ABSENT) {
      await this.ledgerService.creditCarryover(
        selection.customerId,
        subscriptionId,
        selection.id,
        manager,
      );
    }
    // PENDING: no ledger effect (by design — pending days don't affect balance)
  }

  /**
   * Get the kitchen count for a date — how many of each dish, how many absent, how many pending.
   */
  async getKitchenCount(menuDate: string): Promise<KitchenCount> {
    const selections = await this.selectionRepo.find({
      where: { menuDate },
      relations: ['menuItem'],
    });

    const dishCounts = new Map<string, { name: string; count: number }>();
    let absentCount = 0;
    let pendingCount = 0;

    for (const sel of selections) {
      if (sel.state === MealSelectionState.PRESENT && sel.menuItem) {
        const existing = dishCounts.get(sel.menuItemId!);
        if (existing) {
          existing.count++;
        } else {
          dishCounts.set(sel.menuItemId!, { name: sel.menuItem.name, count: 1 });
        }
      } else if (sel.state === MealSelectionState.ABSENT) {
        absentCount++;
      } else {
        pendingCount++;
      }
    }

    return {
      menuDate,
      dishes: Array.from(dishCounts.entries()).map(([menuItemId, data]) => ({
        menuItemId,
        name: data.name,
        count: data.count,
      })),
      absentCount,
      pendingCount,
      totalCustomers: selections.length,
    };
  }

  /**
   * Get all pending selections for a date — the owner's confirmation list.
   */
  async getPendingForDate(menuDate: string): Promise<MealSelection[]> {
    return this.selectionRepo.find({
      where: { menuDate, state: MealSelectionState.PENDING },
      relations: ['customer'],
      order: { customer: { name: 'ASC' } },
    });
  }

  /**
   * Get all unresolved pending days across all dates — appears at top of admin.
   */
  async getAllUnresolvedPending(): Promise<MealSelection[]> {
    return this.selectionRepo.find({
      where: { state: MealSelectionState.PENDING },
      relations: ['customer', 'dailyMenu'],
      order: { menuDate: 'ASC', customer: { name: 'ASC' } },
    });
  }

  /**
   * Get a customer's selection history.
   */
  async getCustomerHistory(
    customerId: string,
    limit = 30,
  ): Promise<MealSelection[]> {
    return this.selectionRepo.find({
      where: { customerId },
      relations: ['menuItem', 'dailyMenu'],
      order: { menuDate: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get a specific selection by customer and date.
   */
  async getByCustomerAndDate(
    customerId: string,
    menuDate: string,
  ): Promise<MealSelection | null> {
    return this.selectionRepo.findOne({
      where: { customerId, menuDate },
      relations: ['menuItem', 'dailyMenu'],
    });
  }
}
