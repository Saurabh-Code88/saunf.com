import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealLedgerEntry } from '../entities/meal-ledger-entry.entity';
import { LedgerService } from './ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([MealLedgerEntry])],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
