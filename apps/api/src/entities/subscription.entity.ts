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
import { Plan } from './plan.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'],
    default: 'ACTIVE',
  })
  status: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** Day of month for invoicing (1–28 to avoid month-length issues). */
  @Column({ name: 'billing_day', type: 'integer', default: 1 })
  billingDay: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (c) => c.subscriptions)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;
}
