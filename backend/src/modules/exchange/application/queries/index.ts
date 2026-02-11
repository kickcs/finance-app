export * from './get-rate/get-rate.query';
export * from './get-rate/get-rate.handler';
export * from './convert-amount/convert-amount.query';
export * from './convert-amount/convert-amount.handler';

import { GetRateHandler } from './get-rate/get-rate.handler';
import { ConvertAmountHandler } from './convert-amount/convert-amount.handler';

export const QueryHandlers = [GetRateHandler, ConvertAmountHandler];
