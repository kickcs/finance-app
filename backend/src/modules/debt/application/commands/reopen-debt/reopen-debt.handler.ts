import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReopenDebtCommand } from './reopen-debt.command';
import { DebtSettlementService } from '../../settlement';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';

/**
 * Отмена закрытия долга: закрытие проведено не тем способом (оплачен вместо
 * прощённого — деньги ошибочно вернулись на счёт). Правку делает долг, а не
 * лента: расчёт, закрывший долг, отменяется целиком в `DebtSettlementService`.
 */
@CommandHandler(ReopenDebtCommand)
export class ReopenDebtHandler implements ICommandHandler<ReopenDebtCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  async execute(command: ReopenDebtCommand): Promise<DebtResponseDto> {
    const debt = await this.settlement.reopen(command.userId, command.id);
    return DebtResponseMapper.toResponse(debt);
  }
}
