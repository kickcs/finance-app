import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { EXCHANGE_RATE_REPOSITORY } from './domain/repositories';
import { CommandHandlers, RateSyncScheduler } from './application';
import {
  EXCHANGE_RATE_CACHE,
  ExchangeRateCacheService,
} from './application/services/exchange-rate-cache.service';
import { QueryHandlers } from './application/queries';
import { ExchangeRateOrmEntity } from './infrastructure/persistence/typeorm';
import { ExchangeRateRepository } from './infrastructure/persistence/repositories';
import { EXCHANGE_RATE_PROVIDER, ExchangeRateApiProvider } from './infrastructure/external';
import { ExchangeRatesController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([ExchangeRateOrmEntity])],
  controllers: [ExchangeRatesController],
  providers: [
    { provide: EXCHANGE_RATE_REPOSITORY, useClass: ExchangeRateRepository },
    { provide: EXCHANGE_RATE_PROVIDER, useClass: ExchangeRateApiProvider },
    { provide: EXCHANGE_RATE_CACHE, useClass: ExchangeRateCacheService },
    ...CommandHandlers,
    ...QueryHandlers,
    RateSyncScheduler,
  ],
  exports: [EXCHANGE_RATE_REPOSITORY, EXCHANGE_RATE_CACHE],
})
export class ExchangeModule {}
