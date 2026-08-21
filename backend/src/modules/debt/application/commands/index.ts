export * from './create-debt/create-debt.command';
export * from './create-debt/create-debt.handler';
export * from './update-debt/update-debt.command';
export * from './update-debt/update-debt.handler';
export * from './delete-debt/delete-debt.command';
export * from './delete-debt/delete-debt.handler';
export * from './reopen-debt/reopen-debt.command';
export * from './reopen-debt/reopen-debt.handler';
export * from './offset-debts/offset-debts.command';
export * from './offset-debts/offset-debts.handler';

import { CreateDebtHandler } from './create-debt/create-debt.handler';
import { UpdateDebtHandler } from './update-debt/update-debt.handler';
import { DeleteDebtHandler } from './delete-debt/delete-debt.handler';
import { ReopenDebtHandler } from './reopen-debt/reopen-debt.handler';
import { OffsetDebtsHandler } from './offset-debts/offset-debts.handler';

export const CommandHandlers = [
  CreateDebtHandler,
  UpdateDebtHandler,
  DeleteDebtHandler,
  ReopenDebtHandler,
  OffsetDebtsHandler,
];
