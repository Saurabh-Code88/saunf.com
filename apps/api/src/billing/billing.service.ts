import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { Subscription } from '../entities/subscription.entity';
import { LedgerService } from '../ledger/ledger.service';
import { MealSelectionState, InvoiceStatus } from '@saunf/shared';

export interface GenerateInvoiceDto {
  subscriptionId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  overrideReason?: string; // Required if there are pending days
  generatedBy: string; // admin_user ID
}

export interface InvoiceSummary {
  invoiceId: string;
  customerId: string;
  mealsInPlan: number;
  carryoverApplied: number;
  mealsCharged: number;
  perMealPaise: number;
  amountDuePaise: number;
  pendingDaysCount: number;
  status: string;
}

/**
 * Billing Service — invoice generation with the pending-days guard.
 *
 * Flow:
 * 1. Check for pending days in the billing period. If any, block unless overridden.
 * 2. Compute carry-over available from the ledger.
 * 3. amount_due = (meals_in_plan - carryover_applied) × per_meal_price.
 * 4. Create the invoice and write CARRYOVER_APPLIED ledger entry.
 * 5. (Phase 4) Create Razorpay payment link and send via WhatsApp.
 * 6. Mark paid only from the verified Razorpay webhook.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(MealSelection)
    private readonly selectionRepo: Repository<MealSelection>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Generate an invoice for a subscription's billing period.
   */
  async generateInvoice(dto: GenerateInvoiceDto): Promise<InvoiceSummary> {
    // 1. Load the subscription and plan
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: dto.subscriptionId },
      relations: ['plan', 'customer'],
    });

    if (!subscription) {
      throw new BadRequestException(
        `Subscription ${dto.subscriptionId} not found`,
      );
    }

    const plan = subscription.plan;
    const customerId = subscription.customerId;

    // 2. Check for pending days in the period (the guard)
    const pendingDays = await this.selectionRepo.count({
      where: {
        customerId,
        menuDate: Between(dto.periodStart, dto.periodEnd) as any,
        state: MealSelectionState.PENDING,
      },
    });

    if (pendingDays > 0 && !dto.overrideReason) {
      throw new BadRequestException(
        `Cannot generate invoice: ${pendingDays} pending day(s) in the billing period. ` +
          `Resolve them first, or provide an override reason.`,
      );
    }

    // 3. Compute carry-over available from the ledger
    const balance = await this.ledgerService.getBalance(customerId);
    const carryoverAvailable = Math.max(0, balance.carryoverBalance);

    // Apply carry-over: up to the full plan meals
    const carryoverToApply = Math.min(carryoverAvailable, plan.mealsPerMonth);
    const mealsCharged = plan.mealsPerMonth - carryoverToApply;
    const perMealPaise = Math.round(plan.pricePaise / plan.mealsPerMonth);
    const amountDuePaise = mealsCharged * perMealPaise;

    // 4. Create the invoice
    const invoice = this.invoiceRepo.create({
      customerId,
      subscriptionId: subscription.id,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      mealsInPlan: plan.mealsPerMonth,
      perMealPaise,
      carryoverApplied: carryoverToApply,
      mealsCharged,
      amountDuePaise,
      pendingDaysCount: pendingDays,
      status: amountDuePaise > 0 ? InvoiceStatus.PENDING_PAYMENT : InvoiceStatus.PAID,
      overrideReason: dto.overrideReason || null,
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // 5. Write CARRYOVER_APPLIED ledger entry if carry-over was used
    if (carryoverToApply > 0) {
      const discountPaise = carryoverToApply * perMealPaise;
      await this.ledgerService.applyCarryover(
        customerId,
        subscription.id,
        savedInvoice.id,
        carryoverToApply,
        discountPaise,
      );
    }

    this.logger.log(
      `Invoice ${savedInvoice.id} generated for customer ${customerId}: ` +
        `₹${(amountDuePaise / 100).toFixed(2)} ` +
        `(${mealsCharged} meals, ${carryoverToApply} carry-over applied)`,
    );

    return {
      invoiceId: savedInvoice.id,
      customerId,
      mealsInPlan: plan.mealsPerMonth,
      carryoverApplied: carryoverToApply,
      mealsCharged,
      perMealPaise,
      amountDuePaise,
      pendingDaysCount: pendingDays,
      status: savedInvoice.status,
    };
  }

  /**
   * Get pending days count for a customer in a date range.
   * Used by the admin panel to show the warning before invoice generation.
   */
  async getPendingDaysCount(
    customerId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<number> {
    return this.selectionRepo.count({
      where: {
        customerId,
        menuDate: Between(periodStart, periodEnd) as any,
        state: MealSelectionState.PENDING,
      },
    });
  }

  /**
   * Get all invoices for a customer.
   */
  async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Mark an invoice as paid (called from the Razorpay webhook handler).
   */
  async markPaid(
    invoiceId: string,
    razorpayPaymentId: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new BadRequestException(`Invoice ${invoiceId} not found`);
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.razorpayPaymentId = razorpayPaymentId;
    invoice.paidAt = new Date();

    return this.invoiceRepo.save(invoice);
  }
}
