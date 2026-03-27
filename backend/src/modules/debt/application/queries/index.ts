export * from './get-debts/get-debts.query';
export * from './get-debts/get-debts.handler';
export * from './get-debt-by-id/get-debt-by-id.query';
export * from './get-debt-by-id/get-debt-by-id.handler';
export * from './get-debts-paginated/get-debts-paginated.query';
export * from './get-debts-paginated/get-debts-paginated.handler';

import { GetDebtsHandler } from './get-debts/get-debts.handler';
import { GetDebtByIdHandler } from './get-debt-by-id/get-debt-by-id.handler';
import { GetDebtsPaginatedHandler } from './get-debts-paginated/get-debts-paginated.handler';

export const QueryHandlers = [GetDebtsHandler, GetDebtByIdHandler, GetDebtsPaginatedHandler];
