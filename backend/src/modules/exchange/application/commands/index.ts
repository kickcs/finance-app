export * from './upsert-rate/upsert-rate.command';
export * from './upsert-rate/upsert-rate.handler';
export * from './sync-rates/sync-rates.command';
export * from './sync-rates/sync-rates.handler';

import { UpsertRateHandler } from './upsert-rate/upsert-rate.handler';
import { SyncRatesHandler } from './sync-rates/sync-rates.handler';

export const CommandHandlers = [UpsertRateHandler, SyncRatesHandler];
