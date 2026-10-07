import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { Subscription } from '../entities/subscription.entity';
import { BillingService } from './billing.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, MealSelection, Subscription]),
    LedgerModule,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
