import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { DATABASE_POOL_CONFIG } from './database.config';

// Load environment variables
dotenv.config();

// ORM Entities from DDD modules
import { ProfileOrmEntity } from '../modules/identity/infrastructure/persistence/typeorm';
import {
  AccountOrmEntity,
  AccountBalanceOrmEntity,
  TransactionOrmEntity,
  CategoryOrmEntity,
  QuickActionOrmEntity,
} from '../modules/accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from '../modules/debt/infrastructure/persistence/typeorm';
import {
  BudgetOrmEntity,
  GoalOrmEntity,
} from '../modules/planning/infrastructure/persistence/typeorm';
import { ExchangeRateOrmEntity } from '../modules/exchange/infrastructure/persistence/typeorm';
import { UserSubscriptionOrmEntity } from '../modules/subscription/infrastructure/persistence/typeorm';
import { PersonOrmEntity } from '../modules/person/infrastructure/persistence/typeorm';
import { PushSubscriptionOrmEntity } from '../modules/notification/infrastructure/persistence/typeorm';
import { RecurringSubscriptionOrmEntity } from '../modules/recurring-subscription/infrastructure/persistence/typeorm';

// Legacy entity
import { Settings } from '../database/entities';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'my_finance',
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
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
    RecurringSubscriptionOrmEntity,
    // Legacy
    Settings,
  ],
  migrations: [
    process.env.NODE_ENV === 'production'
      ? 'dist/database/migrations/*.js'
      : 'src/database/migrations/*.ts',
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: DATABASE_POOL_CONFIG,
};

// DataSource instance for TypeORM CLI
const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
