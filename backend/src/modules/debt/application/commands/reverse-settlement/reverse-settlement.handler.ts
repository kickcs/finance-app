import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReverseSettlementCommand } from './reverse-settlement.command';
import { DebtSettlementService } from '../../settlement';

/** Отмена расчёта по id: правила и порядок живут в `DebtSettlementService`. */
@CommandHandler(ReverseSettlementCommand)
export class ReverseSettlementHandler implements ICommandHandler<ReverseSettlementCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  execute(command: ReverseSettlementCommand): Promise<void> {
    return this.settlement.reverse(command.userId, command.settlementId, command.manager);
  }
}
