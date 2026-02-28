export * from './get-rate/get-rate.query';
export * from './get-rate/get-rate.handler';
export * from './get-batch-rates/get-batch-rates.query';
export * from './get-batch-rates/get-batch-rates.handler';
export * from './convert-amount/convert-amount.query';
export * from './convert-amount/convert-amount.handler';

import { GetRateHandler } from './get-rate/get-rate.handler';
import { GetBatchRatesHandler } from './get-batch-rates/get-batch-rates.handler';
import { ConvertAmountHandler } from './convert-amount/convert-amount.handler';

export const QueryHandlers = [GetRateHandler, GetBatchRatesHandler, ConvertAmountHandler];
