import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Subscription } from './subscription.entity';
import { MealSelection } from './meal-selection.entity';
import { MealLedgerEntry } from './meal-ledger-entry.entity';
import { Invoice } from './invoice.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'wa_opted_in', type: 'boolean', default: false })
  waOptedIn: boolean;

  @Column({ name: 'wa_consent_at', type: 'timestamptz', nullable: true })
  waConsentAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Subscription, (sub) => sub.customer)
  subscriptions: Subscription[];

  @OneToMany(() => MealSelection, (sel) => sel.customer)
  mealSelections: MealSelection[];

  @OneToMany(() => MealLedgerEntry, (entry) => entry.customer)
  ledgerEntries: MealLedgerEntry[];

  @OneToMany(() => Invoice, (inv) => inv.customer)
  invoices: Invoice[];
}
