import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ConfirmImportedCommand } from './confirm-imported.command';
import {
  type IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import {
  CARD_MAPPING_REPOSITORY,
  type ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@CommandHandler(ConfirmImportedCommand)
export class ConfirmImportedHandler implements ICommandHandler<ConfirmImportedCommand> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY)
    private readonly importedRepo: IImportedTransactionRepository,
    @Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository,
  ) {}

  async execute(
    command: ConfirmImportedCommand,
  ): Promise<{ success: boolean; counterpartId: string | null }> {
    const item = await this.importedRepo.findById(command.importedId);
    if (!item) throw new NotFoundException('Imported transaction not found');
    if (item.userId !== command.userId) throw new ForbiddenException();
    if (item.status !== 'pending') throw new ForbiddenException('Already processed');

    await this.importedRepo.markConfirmed(item.id, command.transactionId);

    if (item.cardMask) {
      await this.cardRepo.upsert({
        userId: command.userId,
        cardMask: item.cardMask,
        accountId: command.accountId,
      });
    }

    let counterpartId: string | null = null;
    if (command.toAccountId && item.amount !== null && item.occurredAt) {
      const counterpart = await this.importedRepo.findTransferCounterpart({
        userId: command.userId,
        oppositeType: item.type === 'expense' ? 'income' : 'expense',
        amount: Math.abs(item.amount),
        occurredAt: item.occurredAt,
        counterAccountId: command.toAccountId,
        excludeId: item.id,
      });
      if (counterpart) {
        await this.importedRepo.markConfirmed(counterpart.id, command.transactionId);
        counterpartId = counterpart.id;
      }
    }

    return { success: true, counterpartId };
  }
}
