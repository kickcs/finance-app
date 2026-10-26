import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CloseAllDebtsCommand } from './close-all-debts.command';
import { DebtSettlementService, type CloseAllResultDto } from '../../settlement';

/** «Закрыть все»: план, записи и откат при сбое живут в `DebtSettlementService`. */
@CommandHandler(CloseAllDebtsCommand)
export class CloseAllDebtsHandler implements ICommandHandler<CloseAllDebtsCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  execute(command: CloseAllDebtsCommand): Promise<CloseAllResultDto> {
    return this.settlement.closeAll(command);
  }
}
