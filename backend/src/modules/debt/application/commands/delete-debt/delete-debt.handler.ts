import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteDebtCommand } from './delete-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { TransactionOrmEntity } from '../../../../accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountBalanceOrmEntity } from '../../../../accounting/infrastructure/persistence/typeorm/account-balance.orm-entity';

@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: DeleteDebtCommand): Promise<void> {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== command.userId) throw new ForbiddenException('Access denied');

    // Collect ALL transaction IDs linked to this debt
    const transactionIds = new Set<string>();
    if (debt.transactionId) transactionIds.add(debt.transactionId);
    if (debt.closeTransactionId) transactionIds.add(debt.closeTransactionId);

    // Find all transactions with debt_id = this debt's id (partial payments)
    const debtTransactions = await this.dataSource
      .getRepository(TransactionOrmEntity)
      .find({ where: { debtId: command.id } });

    for (const tx of debtTransactions) {
      transactionIds.add(tx.id);
    }

    // Execute everything atomically
    // TODO: balance reversal logic duplicates BalanceCalculationService.reverseTransaction()
    // and TransferDomainService.reverseTransfer() — extract shared service when resolving
    // circular dependency between debt and accounting modules
    await this.dataSource.transaction(async (manager) => {
      // Reverse balances and delete each transaction
      for (const txId of transactionIds) {
        const tx = await manager.findOne(TransactionOrmEntity, { where: { id: txId } });
        if (!tx) continue;

        // Reverse balance effect on source account
        const balance = await manager.findOne(AccountBalanceOrmEntity, {
          where: { accountId: tx.accountId, currency: tx.currency },
        });
        if (balance) {
          const amount = Number(tx.amount);
          if (tx.type === 'income') {
            balance.balance = Number(balance.balance) - amount;
          } else if (tx.type === 'expense') {
            balance.balance = Number(balance.balance) + amount;
          }
          await manager.save(AccountBalanceOrmEntity, balance);
        }

        // Reverse transfer destination if applicable
        if (tx.type === 'transfer' && tx.toAccountId && tx.toAmount && tx.toCurrency) {
          const toBalance = await manager.findOne(AccountBalanceOrmEntity, {
            where: { accountId: tx.toAccountId, currency: tx.toCurrency },
          });
          if (toBalance) {
            toBalance.balance = Number(toBalance.balance) - Number(tx.toAmount);
            await manager.save(AccountBalanceOrmEntity, toBalance);
          }
        }

        await manager.delete(TransactionOrmEntity, txId);
      }

      // Delete the debt itself
      await manager.delete('debts', command.id);
    });
  }
}
