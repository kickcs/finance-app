import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteDebtCommand } from './delete-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';

@CommandHandler(DeleteDebtCommand)
export class DeleteDebtHandler implements ICommandHandler<DeleteDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
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

    // Multiple debts can share the same source transaction (e.g. split receipt) — only delete it with the last debt
    if (debt.sourceTransactionId) {
      const [{ exists }]: { exists: boolean }[] = await this.dataSource.query(
        'SELECT EXISTS(SELECT 1 FROM debts WHERE source_transaction_id = $1 AND id != $2) as exists',
        [debt.sourceTransactionId, command.id],
      );
      if (!exists) {
        transactionIds.add(debt.sourceTransactionId);
      }
    }

    // Find partial payment transactions linked to this debt via raw SQL
    const debtTxRows: { id: string }[] = await this.dataSource.query(
      'SELECT id FROM transactions WHERE debt_id = $1',
      [command.id],
    );
    for (const row of debtTxRows) {
      transactionIds.add(row.id);
    }

    // Delete each transaction via command bus (handles balance reversal properly)
    for (const txId of transactionIds) {
      try {
        await this.commandBus.execute(new DeleteTransactionCommand(txId, command.userId, true));
      } catch (error) {
        if (error instanceof NotFoundException) continue;
        throw error;
      }
    }

    // Delete the debt using the repository
    await this.debtRepository.delete(command.id);
  }
}
