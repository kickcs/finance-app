import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UpdateDebtCommand } from './update-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';

@CommandHandler(UpdateDebtCommand)
export class UpdateDebtHandler implements ICommandHandler<UpdateDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(command: UpdateDebtCommand) {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    if (debt.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    if (debt.isClosed && command.data.isClosed === true) {
      throw new ConflictException('Debt is already closed');
    }

    debt.update(command.data);
    const savedDebt = await this.debtRepository.save(debt);

    return {
      id: savedDebt.id,
      userId: savedDebt.userId,
      name: savedDebt.name,
      totalAmount: savedDebt.totalAmountValue,
      remainingAmount: savedDebt.remainingAmountValue,
      monthlyPayment: savedDebt.monthlyPaymentValue,
      nextPaymentDate: savedDebt.nextPaymentDate,
      debtType: savedDebt.debtTypeValue,
      personName: savedDebt.personName,
      accountId: savedDebt.accountId,
      transactionId: savedDebt.transactionId,
      closeTransactionId: savedDebt.closeTransactionId,
      isClosed: savedDebt.isClosed,
      currency: savedDebt.currency,
      sourceTransactionId: savedDebt.sourceTransactionId,
      createdAt: savedDebt.createdAt,
    };
  }
}
