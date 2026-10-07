import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Subscription } from './subscription.entity';

/**
 * Append-only meal ledger. Balances are always computed from entries.
 * Never UPDATE or DELETE rows. Corrections use REVERSAL entries.
 *
 * Positive meals = credit (meals added to balance).
 * Negative meals = debit (meals consumed or applied).
 */
@Entity('meal_ledger')
export class MealLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: [
      'PLAN_CREDIT',
      'MEAL_CONSUMED',
      'CARRYOVER_CREDIT',
      'CARRYOVER_APPLIED',
      'REVERSAL',
      'ADJUSTMENT',
    ],
  })
  entryType: string;

  /** Positive = credit, negative = debit. */
  @Column({ type: 'integer' })
  meals: number;

  /** Monetary impact in paise. */
  @Column({ name: 'amount_paise', type: 'integer', default: 0 })
  amountPaise: number;

  /** UUID of the related entity (meal_selection, invoice, etc.). */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  /** Type of the referenced entity: 'meal_selection', 'invoice', 'adjustment'. */
  @Column({ name: 'reference_type', type: 'text', nullable: true })
  referenceType: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Customer, (c) => c.ledgerEntries)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Subscription)
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;
}
