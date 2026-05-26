import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { databaseConfig, jwtConfig } from './config';
import { DATABASE_POOL_CONFIG } from './config/database.config';
import { CommonModule } from './common';
import { SharedModule } from './shared';
import { HealthModule } from './health';
import { ObservabilityModule } from './observability';

// ORM Entities from DDD modules
import { ProfileOrmEntity } from './modules/identity/infrastructure/persistence/typeorm';
import {
  AccountOrmEntity,
  AccountBalanceOrmEntity,
  TransactionOrmEntity,
  CategoryOrmEntity,
  QuickActionOrmEntity,
} from './modules/accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from './modules/debt/infrastructure/persistence/typeorm';
import {
  BudgetOrmEntity,
  GoalOrmEntity,
} from './modules/planning/infrastructure/persistence/typeorm';
import { ExchangeRateOrmEntity } from './modules/exchange/infrastructure/persistence/typeorm';
import { UserSubscriptionOrmEntity } from './modules/subscription/infrastructure/persistence/typeorm';
import { PersonOrmEntity } from './modules/person/infrastructure/persistence/typeorm';
import {
  PushSubscriptionOrmEntity,
  NotificationLogOrmEntity,
  NotificationPreferencesOrmEntity,
  PushDeviceOrmEntity,
} from './modules/notification/infrastructure/persistence/typeorm';
import { RecurringSubscriptionOrmEntity } from './modules/recurring-subscription/infrastructure/persistence/typeorm';

// Legacy entity (to be migrated)
import { Settings } from './database/entities';

// DDD Modules
import { IdentityModule } from './modules/identity';
import { AccountingModule } from './modules/accounting';
import { DebtModule } from './modules/debt';
import { PlanningModule } from './modules/planning';
import { ExchangeModule } from './modules/exchange';
import { SubscriptionModule } from './modules/subscription';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { PersonModule } from './modules/person';
import { NotificationModule } from './modules/notification';
import { RecurringSubscriptionModule } from './modules/recurring-subscription';
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),

    // Global rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        database: configService.get<string>('database.database'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        entities: [
          // DDD ORM Entities
          ProfileOrmEntity,
          AccountOrmEntity,
          AccountBalanceOrmEntity,
          TransactionOrmEntity,
          CategoryOrmEntity,
          QuickActionOrmEntity,
          DebtOrmEntity,
          BudgetOrmEntity,
          GoalOrmEntity,
          ExchangeRateOrmEntity,
          UserSubscriptionOrmEntity,
          PersonOrmEntity,
          PushSubscriptionOrmEntity,
          NotificationLogOrmEntity,
          NotificationPreferencesOrmEntity,
          PushDeviceOrmEntity,
          RecurringSubscriptionOrmEntity,
          // Legacy (to be migrated)
          Settings,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
        extra: DATABASE_POOL_CONFIG,
      }),
      inject: [ConfigService],
    }),

    // Shared Kernel
    SharedModule,

    // Global modules
    CommonModule,

    // DDD Bounded Context modules
    IdentityModule,
    AccountingModule,
    DebtModule,
    PlanningModule,
    ExchangeModule,
    SubscriptionModule,
    ReceiptModule,
    PersonModule,
    NotificationModule,
    RecurringSubscriptionModule,

    // Health check module
    HealthModule,

    // Observability (Prometheus metrics)
    ObservabilityModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
