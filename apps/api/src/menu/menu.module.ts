import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { DailyMenu } from '../entities/daily-menu.entity';
import { DailyMenuItem } from '../entities/daily-menu-item.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem, DailyMenu, DailyMenuItem, MealSelection]),
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
