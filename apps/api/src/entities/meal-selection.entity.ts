import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Customer } from './customer.entity';
import { DailyMenu } from './daily-menu.entity';
import { MenuItem } from './menu-item.entity';

/**
 * One row per customer per day. This is the core state machine.
 * States: PENDING → PRESENT | ABSENT
 * Transitions back (for corrections) are also allowed with audit.
 */
@Entity('meal_selections')
@Unique(['customerId', 'menuDate'])
export class MealSelection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ name: 'daily_menu_id', type: 'uuid' })
  dailyMenuId: string;

  @Index()
  @Column({ name: 'menu_date', type: 'date' })
  menuDate: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PRESENT', 'ABSENT'],
    default: 'PENDING',
  })
  state: string;

  /** The dish the customer chose. NULL when PENDING or ABSENT. */
  @Column({ name: 'menu_item_id', type: 'uuid', nullable: true })
  menuItemId: string | null;

  @Column({
    type: 'enum',
    enum: ['CUSTOMER_VOTE', 'CUSTOMER_FOLLOWUP', 'CUSTOMER_WEB', 'OWNER', 'SYSTEM'],
    default: 'SYSTEM',
  })
  source: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  /** admin_user ID if resolved by owner/staff. */
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (c) => c.mealSelections)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => DailyMenu)
  @JoinColumn({ name: 'daily_menu_id' })
  dailyMenu: DailyMenu;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;
}
