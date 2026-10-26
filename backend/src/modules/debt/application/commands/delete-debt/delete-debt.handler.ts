import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteDebtCommand } from './delete-debt.command';
import { DebtSettlementService } from '../../settlement';

/** Удаление долга со всеми записями: правила и порядок живут в `DebtSettlementService`. */
@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  async execute(command: DeleteDebtCommand): Promise<void> {
    await this.settlement.removeDebt(command.userId, command.id);
  }
}
