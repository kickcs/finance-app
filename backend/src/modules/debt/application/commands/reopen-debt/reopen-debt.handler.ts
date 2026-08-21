import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ReopenDebtCommand } from './reopen-debt.command';
import { Debt } from '../../../domain/aggregates/debt';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

interface CloseTransactionRow {
  id: string;
  category_id: string;
  date: Date;
}

interface OffsetRow {
  id: string;
  debt_id: string;
  amount: string;
}

/**
 * Отменяет закрытие долга: снимает записи, созданные закрытием, и возвращает
 * долг в активные. Нужно, когда закрытие проведено не тем способом — например
 * долг отметили оплаченным вместо прощённого, и деньги ошибочно вернулись на
 * счёт. Отредактировать такую транзакцию напрямую нельзя: долг владеет своими
 * транзакциями, и правка идёт со стороны долга.
 */
@CommandHandler(ReopenDebtCommand)
export class ReopenDebtHandler implements ICommandHandler<ReopenDebtCommand> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    private readonly commandBus: CommandBus,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: ReopenDebtCommand): Promise<DebtResponseDto> {
    const debt = await this.debtRepository.findById(command.id);
    if (!debt) throw new NotFoundException('Debt not found');
    if (debt.userId !== command.userId) throw new ForbiddenException('Access denied');
    if (!debt.isClosed) throw new ConflictException('Debt is not closed');

    const closeTransaction = await this.findCloseTransaction(debt);

    // Зачёт закрыл долг не в одиночку: на другой стороне ровно на ту же сумму
    // уменьшился встречный долг. Отменять его половинками нельзя.
    if (closeTransaction?.category_id === DEBT_CATEGORY_IDS.OFFSET) {
      return this.reverseOffset(debt, closeTransaction);
    }

    // Закрытие оставляет после себя платёж, на который ссылается долг, и —
    // если остаток прощали — информационную запись прощения.
    const closingTransactionIds = new Set<string>();
    if (debt.closeTransactionId) closingTransactionIds.add(debt.closeTransactionId);
    const forgivenRows: { id: string }[] = await this.dataSource.query(
      'SELECT id FROM transactions WHERE debt_id = $1 AND category_id = $2',
      [command.id, DEBT_CATEGORY_IDS.FORGIVEN],
    );
    for (const row of forgivenRows) closingTransactionIds.add(row.id);

    // Сначала транзакции, потом сам долг: если оборвётся посередине, долг
    // останется закрытым и повторная отмена доведёт дело до конца. В обратном
    // порядке остался бы открытый долг и фантомный доход на счёте.
    for (const transactionId of closingTransactionIds) {
      try {
        await this.commandBus.execute(
          new DeleteTransactionCommand(transactionId, command.userId, true),
        );
      } catch (error) {
        if (error instanceof NotFoundException) continue;
        throw error;
      }
    }

    // Остаток считаем по уцелевшим возвратам и зачётам, а не вычитанием суммы
    // закрытия: так частичные платежи, сделанные до закрытия, переживают отмену.
    const paidRows: { paid: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM transactions
       WHERE debt_id = $1
         AND ((is_informational = false AND category_id IN ($2, $3)) OR category_id = $4)`,
      [
        command.id,
        DEBT_CATEGORY_IDS.RETURN_TO_ME,
        DEBT_CATEGORY_IDS.RETURN_FROM_ME,
        DEBT_CATEGORY_IDS.OFFSET,
      ],
    );
    const paid = Number(paidRows[0]?.paid ?? 0);

    // Перечитываем: удаление записи прощения само переоткрывает долг на своей
    // стороне, и сохранение агрегата, прочитанного до удаления, затёрло бы это.
    const reopened = (await this.debtRepository.findById(command.id)) ?? debt;
    reopened.update({
      remainingAmount: Math.max(0, reopened.totalAmountValue - paid),
      isClosed: false,
      forgivenAmount: 0,
      closeTransactionId: null,
    });

    const saved = await this.debtRepository.save(reopened);
    return DebtResponseMapper.toResponse(saved);
  }

  private async findCloseTransaction(debt: Debt): Promise<CloseTransactionRow | null> {
    if (!debt.closeTransactionId) return null;
    const rows: CloseTransactionRow[] = await this.dataSource.query(
      'SELECT id, category_id, date FROM transactions WHERE id = $1',
      [debt.closeTransactionId],
    );
    return rows[0] ?? null;
  }

  /**
   * Разбирает зачёт целиком. Все его записи созданы одним вызовом и потому
   * несут одну и ту же отметку времени — по ней и по человеку с валютой они и
   * находятся: отдельного поля-связки у транзакций нет.
   */
  private async reverseOffset(
    debt: Debt,
    closeTransaction: CloseTransactionRow,
  ): Promise<DebtResponseDto> {
    const rows: OffsetRow[] = await this.dataSource.query(
      `SELECT t.id, t.debt_id, t.amount
       FROM transactions t
       JOIN debts d ON d.id = t.debt_id
       WHERE t.user_id = $1
         AND t.category_id = $2
         AND t.date = $3
         AND d.currency = $4
         AND d.person_name IS NOT DISTINCT FROM $5`,
      [
        debt.userId,
        DEBT_CATEGORY_IDS.OFFSET,
        closeTransaction.date,
        debt.currency,
        debt.personName,
      ],
    );

    const restoredBy = new Map<string, number>();
    for (const row of rows) {
      restoredBy.set(row.debt_id, (restoredBy.get(row.debt_id) ?? 0) + Number(row.amount));
    }

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query('DELETE FROM transactions WHERE id = ANY($1)', [rows.map((r) => r.id)]);

      for (const [debtId, amount] of restoredBy) {
        const affected = debtId === debt.id ? debt : await this.debtRepository.findById(debtId);
        if (!affected) continue;
        affected.update({
          isClosed: false,
          remainingAmount: Math.min(
            affected.totalAmountValue,
            affected.remainingAmountValue + amount,
          ),
          ...(affected.closeTransactionId && rows.some((r) => r.id === affected.closeTransactionId)
            ? { closeTransactionId: null }
            : {}),
        });
        await this.debtRepository.save(affected, manager);
      }
    });

    const reloaded = (await this.debtRepository.findById(debt.id)) ?? debt;
    return DebtResponseMapper.toResponse(reloaded);
  }
}
