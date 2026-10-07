import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealSelection } from '../entities/meal-selection.entity';
import { SelectionAudit } from '../entities/selection-audit.entity';
import { DailyMenu } from '../entities/daily-menu.entity';
import { Subscription } from '../entities/subscription.entity';
import { SelectionsService } from './selections.service';
import { SelectionsController } from './selections.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealSelection, SelectionAudit, DailyMenu, Subscription]),
    LedgerModule,
  ],
  controllers: [SelectionsController],
  providers: [SelectionsService],
  exports: [SelectionsService],
})
export class SelectionsModule {}
