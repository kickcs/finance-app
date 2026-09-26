import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteTransactionCommand } from './delete-transaction.command';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../../debt/domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';
import { BalanceCalculationService, TransferDomainService } from '../../../domain/services';
import {
  DEBT_CATEGORY_IDS,
  ALL_DEBT_CATEGORY_IDS,
} from '../../../domain/constants/default-categories';

@CommandHandler(DeleteTransactionCommand)
export class DeleteTransactionHandler implements ICommandHandler<DeleteTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Есть ли у возврата парная нога работы: та же дата, тот же долг, недолговая
   * категория. Отдельного поля-связки у транзакций нет, но `debt_id` с
   * недолговой категорией ставит только отработка.
   */
  private async hasWorkLeg(transaction: { debtId: string | null; date: Date }): Promise<boolean> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM transactions
       WHERE debt_id = $1 AND date = $2 AND is_informational = false
         AND category_id <> ALL($3::text[])
       LIMIT 1`,
      [transaction.debtId, transaction.date, ALL_DEBT_CATEGORY_IDS],
    );
    return rows.length > 0;
  }

  async execute(command: DeleteTransactionCommand): Promise<void> {
    const transaction = await this.transactionRepository.findById(command.id);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== command.userId) {
      throw new ForbiddenException('Transaction does not belong to user');
    }

    // Зачёт всегда двусторонний: удалив одну его запись, вторую сторону оставили
    // бы уменьшенной без причины. Разбирается он только со стороны долга.
    if (transaction.categoryId === DEBT_CATEGORY_IDS.OFFSET) {
      throw new BadRequestException(
        'Запись о взаимозачёте нельзя удалить — отмените зачёт со стороны долга.',
      );
    }

    // Отработка гасит долг, ничего не двигая по счетам: удалив её из ленты,
    // пользователь уменьшил бы долг «просто так». Снимается она отменой
    // закрытия — оттуда команда приходит с `skipDebtCheck`.
    if (transaction.categoryId === DEBT_CATEGORY_IDS.WORKED_OFF && !command.skipDebtCheck) {
      throw new BadRequestException(
        'Запись об отработке нельзя удалить — отмените закрытие со стороны долга.',
      );
    }

    // Отработка, зачтённая по категории, — пара записей на ноль по балансу:
    // трата по категории и возврат долга. Удалив одну ногу, пользователь
    // оставил бы на счёте дыру на её сумму, поэтому пара снимается только со
    // стороны долга — оттуда команда приходит с `skipDebtCheck`.
    if (!command.skipDebtCheck && transaction.debtId) {
      const isWorkLeg =
        !transaction.isInformational && !ALL_DEBT_CATEGORY_IDS.includes(transaction.categoryId);
      const isReturnLeg =
        transaction.categoryId === DEBT_CATEGORY_IDS.RETURN_TO_ME ||
        transaction.categoryId === DEBT_CATEGORY_IDS.RETURN_FROM_ME;

      if (isWorkLeg || (isReturnLeg && (await this.hasWorkLeg(transaction)))) {
        throw new BadRequestException(
          'Запись об отработке нельзя удалить по отдельности — снимите её со стороны долга.',
        );
      }
    }

    // Prevent deletion if transaction is linked to open debts (as source or direct transaction)
    if (!command.skipDebtCheck) {
      const hasOpenDebts = await this.debtRepository.hasOpenDebtsForTransaction(command.id);
      if (hasOpenDebts) {
        throw new BadRequestException(
          'Нельзя удалить транзакцию, пока есть связанные открытые долги. Сначала закройте долги.',
        );
      }
    }

    // Informational transactions never modified the account balance, so we skip
    // the reversal step entirely. Loading the account is also unnecessary.
    const account = transaction.isInformational
      ? null
      : await this.accountRepository.findByIdWithBalances(transaction.accountId);

    // If this is the forgiveness info-tx attached to a closed debt, reverse the
    // forgiveness on the debt side too — otherwise debts.close_transaction_id
    // dangles (no FK) and the debt remains is_closed=true with no way to undo.
    // Только прощение: остаток восстанавливается из `forgiven_amount`, которого
    // у отработки нет — её отмена пересчитывает остаток на стороне долга.
    const linkedClosedDebt =
      transaction.isInformational && transaction.categoryId === DEBT_CATEGORY_IDS.FORGIVEN
        ? await this.debtRepository.findByCloseTransactionId(command.id)
        : null;

    // Mark transaction as deleted (raises event)
    transaction.markDeleted();

    // Wrap all balance reversals + delete in a DB transaction
    await this.dataSource.transaction(async (manager) => {
      if (account) {
        if (transaction.type.isTransfer() && transaction.toAccountId) {
          // Intra-account conversion: both sides must share one aggregate
          // instance, otherwise the second save overwrites the first.
          const toAccount =
            transaction.toAccountId === transaction.accountId
              ? account
              : await this.accountRepository.findByIdWithBalances(transaction.toAccountId);
          if (!toAccount) {
            throw new NotFoundException(
              'Destination account not found, cannot safely delete transfer',
            );
          }
          TransferDomainService.reverseTransfer(
            account,
            toAccount,
            transaction.amountValue,
            transaction.currency,
            transaction.toAmountValue!,
            transaction.toCurrency!,
          );
          if (toAccount !== account) {
            await this.accountRepository.save(toAccount, manager);
          }
        } else {
          BalanceCalculationService.reverseTransaction(account, transaction);
        }
        await this.accountRepository.save(account, manager);
      }

      if (linkedClosedDebt) {
        const restoredRemaining = linkedClosedDebt.forgivenAmount;
        linkedClosedDebt.update({
          closeTransactionId: null,
          forgivenAmount: 0,
          isClosed: false,
          remainingAmount: restoredRemaining,
        });
        await this.debtRepository.save(linkedClosedDebt, manager);
      }

      await this.transactionRepository.delete(command.id, manager);
    });

    // Publish events after commit
    if (account) {
      await this.eventPublisher.publishEvents(account);
    }
    if (linkedClosedDebt) {
      await this.eventPublisher.publishEvents(linkedClosedDebt);
    }
    await this.eventPublisher.publishEvents(transaction);
  }
}
