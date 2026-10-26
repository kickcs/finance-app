import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OffsetDebtsCommand } from './offset-debts.command';
import { DebtSettlementService, type OffsetDebtsResultDto } from '../../settlement';

/** Взаимозачёт встречных долгов человека: правила и записи живут в `DebtSettlementService`. */
@CommandHandler(OffsetDebtsCommand)
export class OffsetDebtsHandler implements ICommandHandler<OffsetDebtsCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  execute(command: OffsetDebtsCommand): Promise<OffsetDebtsResultDto> {
    return this.settlement.offset(command);
  }
}
