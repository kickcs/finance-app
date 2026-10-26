import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReverseSettlementCommand } from './reverse-settlement.command';
import { DebtSettlementService } from '../../settlement';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';

/** Отмена расчёта по id: правила и порядок живут в `DebtSettlementService`. */
@CommandHandler(ReverseSettlementCommand)
export class ReverseSettlementHandler implements ICommandHandler<ReverseSettlementCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  async execute(command: ReverseSettlementCommand): Promise<DebtResponseDto[]> {
    const debts = await this.settlement.reverse(
      command.userId,
      command.settlementId,
      command.manager,
    );
    return debts.map((debt) => DebtResponseMapper.toResponse(debt));
  }
}
