import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyMenu } from '../entities/daily-menu.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { Subscription } from '../entities/subscription.entity';
import { Customer } from '../entities/customer.entity';
import { SelectionsModule } from '../selections/selections.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyMenu, MealSelection, Subscription, Customer]),
    SelectionsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
