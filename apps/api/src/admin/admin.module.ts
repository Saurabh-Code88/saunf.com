import { Module } from '@nestjs/common';
import { SelectionsModule } from '../selections/selections.module';
import { LedgerModule } from '../ledger/ledger.module';
import { BillingModule } from '../billing/billing.module';

/**
 * Admin module — will contain controllers for:
 * - Daily view (kitchen count, customer states)
 * - Pending confirmation list
 * - Manual adjustments
 * - Invoice generation
 * - Menu management
 */
@Module({
  imports: [SelectionsModule, LedgerModule, BillingModule],
  controllers: [],
  providers: [],
})
export class AdminModule {}
