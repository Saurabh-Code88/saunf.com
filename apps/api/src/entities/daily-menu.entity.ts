import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DailyMenuItem } from './daily-menu-item.entity';

@Entity('daily_menus')
export class DailyMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'menu_date', type: 'date' })
  menuDate: string;

  @Column({ name: 'send_time', type: 'timestamptz', nullable: true })
  sendTime: Date | null;

  @Column({ name: 'cutoff_time', type: 'timestamptz', nullable: true })
  cutoffTime: Date | null;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => DailyMenuItem, (dmi) => dmi.dailyMenu, { cascade: true })
  items: DailyMenuItem[];
}
