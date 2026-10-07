import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { PlansModule } from './plans/plans.module';
import { MenuModule } from './menu/menu.module';
import { SelectionsModule } from './selections/selections.module';
import { LedgerModule } from './ledger/ledger.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { Customer } from './entities/customer.entity';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { MenuItem } from './entities/menu-item.entity';
import { DailyMenu } from './entities/daily-menu.entity';
import { DailyMenuItem } from './entities/daily-menu-item.entity';
import { MealSelection } from './entities/meal-selection.entity';
import { SelectionAudit } from './entities/selection-audit.entity';
import { MealLedgerEntry } from './entities/meal-ledger-entry.entity';
import { Invoice } from './entities/invoice.entity';
import { Staff } from './entities/staff.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'saunf',
      password: process.env.DATABASE_PASSWORD || 'saunf_dev_password',
      database: process.env.DATABASE_NAME || 'saunf',
      entities: [
        Customer,
        Subscription,
        Plan,
        MenuItem,
        DailyMenu,
        DailyMenuItem,
        MealSelection,
        SelectionAudit,
        MealLedgerEntry,
        Invoice,
        Staff,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    CustomersModule,
    PlansModule,
    MenuModule,
    SelectionsModule,
    LedgerModule,
    BillingModule,
    AdminModule,
  ],
})
export class AppModule {}
