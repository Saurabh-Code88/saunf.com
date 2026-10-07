import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { DailyMenu } from './daily-menu.entity';
import { MenuItem } from './menu-item.entity';

@Entity('daily_menu_items')
@Unique(['dailyMenuId', 'menuItemId'])
export class DailyMenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'daily_menu_id', type: 'uuid' })
  dailyMenuId: string;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId: string;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  // Relations
  @ManyToOne(() => DailyMenu, (dm) => dm.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'daily_menu_id' })
  dailyMenu: DailyMenu;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;
}
