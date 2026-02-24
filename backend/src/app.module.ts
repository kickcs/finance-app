import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseConfig, jwtConfig } from './config';
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
} from './modules/accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from './modules/debt/infrastructure/persistence/typeorm';
import {
  GoalOrmEntity,
  ReminderOrmEntity,
} from './modules/planning/infrastructure/persistence/typeorm';
import { ExchangeRateOrmEntity } from './modules/exchange/infrastructure/persistence/typeorm';
import { UserSubscriptionOrmEntity } from './modules/subscription/infrastructure/persistence/typeorm';

// Legacy entity (to be migrated)
import { Settings } from './database/entities';

// DDD Modules
import { IdentityModule } from './modules/identity';
import { AccountingModule } from './modules/accounting';
import { DebtModule } from './modules/debt';
import { PlanningModule } from './modules/planning';
import { ExchangeModule } from './modules/exchange';
import { SubscriptionModule } from './modules/subscription';
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),

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
          DebtOrmEntity,
          GoalOrmEntity,
          ReminderOrmEntity,
          ExchangeRateOrmEntity,
          UserSubscriptionOrmEntity,
          // Legacy (to be migrated)
          Settings,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
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

    // Health check module
    HealthModule,

    // Observability (Prometheus metrics)
    ObservabilityModule,
  ],
})
export class AppModule {}
