import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DismissImportedCommand } from './dismiss-imported.command';
import {
  type IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';

@CommandHandler(DismissImportedCommand)
export class DismissImportedHandler implements ICommandHandler<DismissImportedCommand> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY)
    private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(command: DismissImportedCommand): Promise<{ success: boolean }> {
    const item = await this.importedRepo.findById(command.importedId);
    if (!item) throw new NotFoundException('Imported transaction not found');
    if (item.userId !== command.userId) throw new ForbiddenException();
    if (item.status !== 'pending') throw new ForbiddenException('Already processed');
    await this.importedRepo.markDismissed(item.id);
    return { success: true };
  }
}
