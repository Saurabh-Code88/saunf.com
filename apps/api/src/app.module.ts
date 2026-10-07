import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersModule } from './customers/customers.module';
import { PlansModule } from './plans/plans.module';
import { MenuModule } from './menu/menu.module';
import { SelectionsModule } from './selections/selections.module';
import { LedgerModule } from './ledger/ledger.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // Load .env from the monorepo root
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'saunf'),
        password: config.get('DATABASE_PASSWORD', 'saunf_dev_password'),
        database: config.get('DATABASE_NAME', 'saunf'),
        autoLoadEntities: true,
        // In production, use migrations. Synchronize is convenient in early dev.
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') !== 'production' ? ['error', 'warn'] : false,
      }),
    }),

    // Feature modules
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
