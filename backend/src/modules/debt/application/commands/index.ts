export * from './create-debt/create-debt.command';
export * from './create-debt/create-debt.handler';
export * from './update-debt/update-debt.command';
export * from './update-debt/update-debt.handler';
export * from './delete-debt/delete-debt.command';
export * from './delete-debt/delete-debt.handler';

import { CreateDebtHandler } from './create-debt/create-debt.handler';
import { UpdateDebtHandler } from './update-debt/update-debt.handler';
import { DeleteDebtHandler } from './delete-debt/delete-debt.handler';

export const CommandHandlers = [CreateDebtHandler, UpdateDebtHandler, DeleteDebtHandler];
