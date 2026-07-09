import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { ProfileLanguageResolver } from './modules/identity/infrastructure/i18n/profile-language.resolver';

import { databaseConfig, jwtConfig } from './config';
import { DATABASE_POOL_CONFIG } from './config/database.config';
import { CommonModule } from './common';
import { SharedModule } from './shared';
import { HealthModule } from './health';
import { ObservabilityModule } from './observability';

// ORM Entities from DDD modules
import {
  ProfileOrmEntity,
  PaymentMethodOrmEntity,
} from './modules/identity/infrastructure/persistence/typeorm';
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
import { SharedReceiptOrmEntity } from './modules/receipt/infrastructure/persistence/typeorm';
import {
  PushSubscriptionOrmEntity,
  NotificationLogOrmEntity,
  NotificationPreferencesOrmEntity,
} from './modules/notification/infrastructure/persistence/typeorm';
import { RecurringSubscriptionOrmEntity } from './modules/recurring-subscription/infrastructure/persistence/typeorm';
import {
  TelegramLinkOrmEntity,
  TelegramLinkTokenOrmEntity,
  ImportedTransactionOrmEntity,
  CardAccountMappingOrmEntity,
} from './modules/telegram-import/infrastructure/persistence/typeorm';

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
import { TelegramImportModule } from './modules/telegram-import/telegram-import.module';
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
          PaymentMethodOrmEntity,
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
          SharedReceiptOrmEntity,
          PushSubscriptionOrmEntity,
          NotificationLogOrmEntity,
          NotificationPreferencesOrmEntity,
          RecurringSubscriptionOrmEntity,
          TelegramLinkOrmEntity,
          TelegramLinkTokenOrmEntity,
          ImportedTransactionOrmEntity,
          CardAccountMappingOrmEntity,
          // Legacy (to be migrated)
          Settings,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
        extra: DATABASE_POOL_CONFIG,
      }),
      inject: [ConfigService],
    }),

    // Internationalisation
    I18nModule.forRoot({
      fallbackLanguage: 'ru',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [ProfileLanguageResolver, new AcceptLanguageResolver()],
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
    TelegramImportModule,

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
    ProfileLanguageResolver,
  ],
})
export class AppModule {}
