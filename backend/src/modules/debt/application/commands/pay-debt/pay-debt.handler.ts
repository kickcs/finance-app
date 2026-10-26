import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PayDebtCommand } from './pay-debt.command';
import { DebtSettlementService, type PayDebtResultDto } from '../../settlement';

/** Платёж по долгу: правила и записи живут в `DebtSettlementService`. */
@CommandHandler(PayDebtCommand)
export class PayDebtHandler implements ICommandHandler<PayDebtCommand> {
  constructor(private readonly settlement: DebtSettlementService) {}

  execute(command: PayDebtCommand): Promise<PayDebtResultDto> {
    return this.settlement.pay(command);
  }
}
