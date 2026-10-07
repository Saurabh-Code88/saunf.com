import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Subscription } from './subscription.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'meals_in_plan', type: 'integer' })
  mealsInPlan: number;

  @Column({ name: 'per_meal_paise', type: 'integer' })
  perMealPaise: number;

  @Column({ name: 'carryover_applied', type: 'integer', default: 0 })
  carryoverApplied: number;

  @Column({ name: 'meals_charged', type: 'integer' })
  mealsCharged: number;

  @Column({ name: 'amount_due_paise', type: 'integer' })
  amountDuePaise: number;

  @Column({ name: 'pending_days_count', type: 'integer', default: 0 })
  pendingDaysCount: number;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'OVERDUE', 'CANCELLED'],
    default: 'DRAFT',
  })
  status: string;

  @Column({ name: 'razorpay_link_id', type: 'text', nullable: true })
  razorpayLinkId: string | null;

  @Column({ name: 'razorpay_payment_id', type: 'text', nullable: true })
  razorpayPaymentId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (c) => c.invoices)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Subscription)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;
}
