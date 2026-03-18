import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateDebtCommand } from './create-debt.command';
import { Debt } from '../../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@CommandHandler(CreateDebtCommand)
export class CreateDebtHandler implements ICommandHandler<CreateDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateDebtCommand) {
    const debt = Debt.create({
      id: crypto.randomUUID(),
      userId: command.userId,
      name: command.name,
      totalAmount: command.totalAmount,
      currency: command.currency,
      debtType: command.debtType,
      personName: command.personName,
      accountId: command.accountId,
      monthlyPayment: command.monthlyPayment,
      nextPaymentDate: command.nextPaymentDate,
      createdAt: command.createdAt,
      description: command.description,
    });

    if (command.transactionId) {
      debt.setTransactionId(command.transactionId);
    }

    if (command.sourceTransactionId) {
      debt.update({ sourceTransactionId: command.sourceTransactionId });
    }

    // Set initial remaining amount if different from total
    if (command.remainingAmount !== command.totalAmount) {
      debt.update({ remainingAmount: command.remainingAmount });
    }

    if (command.isPrivate !== undefined) {
      debt.update({ isPrivate: command.isPrivate });
    }

    const savedDebt = await this.debtRepository.save(debt);
    await this.eventPublisher.publishEvents(debt);

    return DebtResponseMapper.toResponse(savedDebt);
  }
}
