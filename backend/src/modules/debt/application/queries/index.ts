export * from './get-debts/get-debts.query';
export * from './get-debts/get-debts.handler';
export * from './get-debt-by-id/get-debt-by-id.query';
export * from './get-debt-by-id/get-debt-by-id.handler';

import { GetDebtsHandler } from './get-debts/get-debts.handler';
import { GetDebtByIdHandler } from './get-debt-by-id/get-debt-by-id.handler';

export const QueryHandlers = [GetDebtsHandler, GetDebtByIdHandler];
