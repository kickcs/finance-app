import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
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
import { ReverseSettlementCommand } from '../../../../debt/application/commands/reverse-settlement/reverse-settlement.command';
import { DomainEventPublisher } from '../../../../../shared';
import { runInTransaction } from '../../../../../shared/infrastructure/run-in-transaction';
import { BalanceCalculationService, TransferDomainService } from '../../../domain/services';
import { DEBT_CATEGORY_IDS } from '../../../domain/constants/default-categories';

/** Страховка: информационная запись расчёта без `settlement_id` не удаляется из ленты — снять расчёт целиком нечем. */
const ORPHAN_SETTLEMENT_GUARDS = new Map<string, string>([
  [
    DEBT_CATEGORY_IDS.OFFSET,
    'Запись о взаимозачёте нельзя удалить — отмените зачёт со стороны долга.',
  ],
  [
    DEBT_CATEGORY_IDS.WORKED_OFF,
    'Запись об отработке нельзя удалить — отмените закрытие со стороны долга.',
  ],
  [
    DEBT_CATEGORY_IDS.FORGIVEN,
    'Запись о прощении нельзя удалить — отмените закрытие со стороны долга.',
  ],
]);

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
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: DeleteTransactionCommand): Promise<void> {
    // Внешний менеджер: все чтения идут через него, иначе вторая запись того же
    // счёта перечитает баланс мимо открытой транзакции и затрёт первую.
    const outerManager = command.manager;
    const transaction = await this.transactionRepository.findById(command.id, outerManager);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== command.userId) {
      throw new ForbiddenException('Transaction does not belong to user');
    }

    // С `skipDebtCheck` команда приходит от самой отмены расчёта или удаления долга:
    // записи снимаются по одной, а остатки долгов правит вызывающий.
    if (!command.skipDebtCheck) {
      // Запись расчёта не живёт отдельно: уходит расчёт целиком, с проверкой порядка и остатков.
      if (transaction.settlementId) {
        await this.commandBus.execute(
          new ReverseSettlementCommand(transaction.settlementId, command.userId, outerManager),
        );
        return;
      }

      const orphanGuard = ORPHAN_SETTLEMENT_GUARDS.get(transaction.categoryId);
      if (orphanGuard) {
        throw new BadRequestException(orphanGuard);
      }
    }

    // Вторая часть оплаты с двух счетов удаляется вместе со строкой: операция одна.
    const sibling = await this.transactionRepository.findPaymentSibling(transaction, outerManager);

    // Prevent deletion if transaction is linked to open debts (as source or direct transaction).
    // Долги участников чека привязаны к одной из частей — проверяются обе.
    if (!command.skipDebtCheck) {
      const hasOpenDebts =
        (await this.debtRepository.hasOpenDebtsForTransaction(command.id, outerManager)) ||
        (sibling !== null &&
          (await this.debtRepository.hasOpenDebtsForTransaction(sibling.id, outerManager)));
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
      : await this.accountRepository.findByIdWithBalances(transaction.accountId, outerManager);
    // Части оплаты всегда на разных счетах, поэтому отдельная загрузка безопасна.
    const siblingAccount = sibling
      ? await this.accountRepository.findByIdWithBalances(sibling.accountId, outerManager)
      : null;

    // Mark transaction as deleted (raises event)
    transaction.markDeleted();
    sibling?.markDeleted();

    // Откат балансов и удаление — одной транзакцией БД: внешней, если передана, иначе своей.
    const persist = async (manager: EntityManager) => {
      if (account) {
        if (transaction.type.isTransfer() && transaction.toAccountId) {
          // Intra-account conversion: both sides must share one aggregate
          // instance, otherwise the second save overwrites the first.
          const toAccount =
            transaction.toAccountId === transaction.accountId
              ? account
              : await this.accountRepository.findByIdWithBalances(
                  transaction.toAccountId,
                  outerManager,
                );
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

      if (sibling && siblingAccount) {
        BalanceCalculationService.reverseTransaction(siblingAccount, sibling);
        await this.accountRepository.save(siblingAccount, manager);
      }

      await this.transactionRepository.delete(command.id, manager);
      if (sibling) {
        await this.transactionRepository.delete(sibling.id, manager);
      }
    };

    await runInTransaction(this.dataSource, outerManager, persist);

    // События уходят после записи; во внешней транзакции коммит ещё за вызывающим.
    if (account) {
      await this.eventPublisher.publishEvents(account);
    }
    if (siblingAccount) {
      await this.eventPublisher.publishEvents(siblingAccount);
    }
    await this.eventPublisher.publishEvents(transaction);
    if (sibling) {
      await this.eventPublisher.publishEvents(sibling);
    }
  }
}
