import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReopenDebtCommand } from './reopen-debt.command';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper, type DebtResponseDto } from '../../mappers/debt-response.mapper';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

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

    // Остаток считаем по уцелевшим возвратам, а не вычитанием суммы закрытия:
    // так частичные платежи, сделанные до закрытия, переживают отмену.
    const paidRows: { paid: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM transactions
       WHERE debt_id = $1 AND is_informational = false AND category_id IN ($2, $3)`,
      [command.id, DEBT_CATEGORY_IDS.RETURN_TO_ME, DEBT_CATEGORY_IDS.RETURN_FROM_ME],
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
}
