import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MealSelection } from './meal-selection.entity';
import { MenuItem } from './menu-item.entity';

/**
 * Every state change on a MealSelection is recorded here.
 * This is the audit trail — never delete rows from this table.
 */
@Entity('selection_audit')
export class SelectionAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'meal_selection_id', type: 'uuid' })
  mealSelectionId: string;

  @Column({
    name: 'previous_state',
    type: 'enum',
    enum: ['PENDING', 'PRESENT', 'ABSENT'],
    nullable: true,
  })
  previousState: string | null;

  @Column({
    name: 'new_state',
    type: 'enum',
    enum: ['PENDING', 'PRESENT', 'ABSENT'],
  })
  newState: string;

  @Column({ name: 'previous_item_id', type: 'uuid', nullable: true })
  previousItemId: string | null;

  @Column({ name: 'new_item_id', type: 'uuid', nullable: true })
  newItemId: string | null;

  @Column({
    type: 'enum',
    enum: ['CUSTOMER_VOTE', 'CUSTOMER_FOLLOWUP', 'CUSTOMER_WEB', 'OWNER', 'SYSTEM'],
  })
  source: string;

  /** UUID of the customer or admin_user who made the change. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_type', type: 'text', nullable: true })
  actorType: string | null;

  /** Required for owner overrides and corrections. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => MealSelection)
  @JoinColumn({ name: 'meal_selection_id' })
  mealSelection: MealSelection;
}
