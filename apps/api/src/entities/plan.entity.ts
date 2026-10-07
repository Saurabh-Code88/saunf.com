import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'meals_per_month', type: 'integer', default: 30 })
  mealsPerMonth: number;

  /** Total plan price in paise. ₹1 = 100 paise. */
  @Column({ name: 'price_paise', type: 'integer' })
  pricePaise: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Derived: per-meal price in paise. Computed, not stored. */
  get perMealPaise(): number {
    return Math.round(this.pricePaise / this.mealsPerMonth);
  }
}
