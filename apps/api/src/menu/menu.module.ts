import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { DailyMenu } from '../entities/daily-menu.entity';
import { DailyMenuItem } from '../entities/daily-menu-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem, DailyMenu, DailyMenuItem])],
  providers: [],
  exports: [],
})
export class MenuModule {}
