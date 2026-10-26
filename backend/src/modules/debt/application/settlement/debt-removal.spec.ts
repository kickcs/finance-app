import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import type { DataSource, EntityManager } from 'typeorm';
import { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';
import type { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { removeDebtWithRecords } from './debt-removal';
import { reverseSettlement } from './settlement-reversal';

jest.mock('./settlement-reversal');

describe('removeDebtWithRecords', () => {
  const calls: string[] = [];
  const managerQuery = jest.fn();
  const manager = { query: managerQuery } as unknown as EntityManager;
  const debtRepository = { findById: jest.fn(), delete: jest.fn() };
  const commandBus = { execute: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const deps = {
    debtRepository: debtRepository as unknown as IDebtRepository,
    commandBus: commandBus as unknown as CommandBus,
    dataSource: dataSource as unknown as DataSource,
  };
  const reverse = jest.mocked(reverseSettlement);

  const makeDebt = (overrides: Partial<Parameters<typeof Debt.create>[0]> = {}) => {
    const debt = Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Долг',
      totalAmount: 300,
      currency: 'UZS',
      debtType: 'given',
      ...overrides,
    });
    return debt;
  };

  /** Ответы на запросы модуля по тексту SQL: расчёты долга, записи расчётов, остаток. */
  const givenRows = (rows: {
    settlements?: { settlement_id: string; shared: boolean }[];
    settlementRecords?: string[];
    otherDebtsOnSource?: boolean;
    remaining?: string[];
  }) => {
    managerQuery.mockImplementation((sql: string) => {
      if (sql.includes('BOOL_OR')) return Promise.resolve(rows.settlements ?? []);
      if (sql.includes('settlement_id = ANY')) {
        return Promise.resolve((rows.settlementRecords ?? []).map((id) => ({ id })));
      }
      if (sql.includes('EXISTS')) return Promise.resolve([{ exists: !!rows.otherDebtsOnSource }]);
      return Promise.resolve((rows.remaining ?? []).map((id) => ({ id })));
    });
  };

  beforeEach(() => {
    calls.length = 0;
    jest.resetAllMocks();
    debtRepository.findById.mockResolvedValue(makeDebt());
    debtRepository.delete.mockImplementation(() => {
      calls.push('delete-debt');
      return Promise.resolve();
    });
    commandBus.execute.mockImplementation((command: DeleteTransactionCommand) => {
      calls.push(`delete:${command.id}`);
      return Promise.resolve();
    });
    reverse.mockImplementation((_deps, _userId, settlementId) => {
      calls.push(`reverse:${settlementId}`);
      return Promise.resolve([]);
    });
    dataSource.transaction.mockImplementation((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    );
    givenRows({});
  });

  it('читает долг через менеджер: 404, если долга нет, и 403, если долг чужой', async () => {
    debtRepository.findById.mockResolvedValueOnce(null);
    await expect(removeDebtWithRecords(deps, 'user-1', 'debt-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    debtRepository.findById.mockResolvedValueOnce(makeDebt({ userId: 'other-user' }));
    await expect(removeDebtWithRecords(deps, 'user-1', 'debt-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(debtRepository.findById).toHaveBeenCalledWith('debt-1', manager);
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(debtRepository.delete).not.toHaveBeenCalled();
  });

  it('порядок: свои расчёты, затем общие от нового к старому, затем остальное, затем сам долг', async () => {
    givenRows({
      settlements: [
        { settlement_id: 's-new-offset', shared: true },
        { settlement_id: 's-payment', shared: false },
        { settlement_id: 's-old-offset', shared: true },
      ],
      settlementRecords: ['pay-1', 'excess-1'],
      remaining: ['issue-1'],
    });

    await removeDebtWithRecords(deps, 'user-1', 'debt-1');

    expect(calls).toEqual([
      'delete:pay-1',
      'delete:excess-1',
      'reverse:s-new-offset',
      'reverse:s-old-offset',
      'delete:issue-1',
      'delete-debt',
    ]);
  });

  it('все удаления и отмены идут в одной транзакции БД через её менеджер', async () => {
    givenRows({
      settlements: [{ settlement_id: 's-offset', shared: true }],
      remaining: ['issue-1'],
    });

    await removeDebtWithRecords(deps, 'user-1', 'debt-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(reverse).toHaveBeenCalledWith(deps, 'user-1', 's-offset', manager);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'issue-1', userId: 'user-1', skipDebtCheck: true, manager }),
    );
    expect(debtRepository.delete).toHaveBeenCalledWith('debt-1', manager);
  });

  it('у долга без расчётов записей расчётов не ищет', async () => {
    givenRows({ remaining: ['issue-1'] });

    await removeDebtWithRecords(deps, 'user-1', 'debt-1');

    expect(
      managerQuery.mock.calls.some(([sql]: [string]) => sql.includes('settlement_id = ANY')),
    ).toBe(false);
    expect(reverse).not.toHaveBeenCalled();
    expect(calls).toEqual(['delete:issue-1', 'delete-debt']);
  });

  it('связанные записи долга (выдача, закрытие, комиссия) ищутся вместе с записями по debt_id', async () => {
    const debt = makeDebt();
    debt.setTransactionId('issue-1');
    debt.setCloseTransactionId('close-1');
    debt.setFee(10, 'fee-1');
    debtRepository.findById.mockResolvedValue(debt);

    await removeDebtWithRecords(deps, 'user-1', 'debt-1');

    const remainingCall = managerQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('debt_id = $1 OR id = ANY'),
    ) as [string, [string, string[]]];
    expect(remainingCall[1][0]).toBe('debt-1');
    expect(remainingCall[1][1]).toEqual(['issue-1', 'close-1', 'fee-1']);
  });

  it.each([
    ['последний долг на исходной записи', false, ['issue-1', 'source-1']],
    ['другой долг на исходной записи', true, ['issue-1']],
  ])('исходная запись чека: %s', async (_name, otherDebtsOnSource, expected) => {
    const debt = makeDebt();
    debt.setTransactionId('issue-1');
    debt.update({ sourceTransactionId: 'source-1' });
    debtRepository.findById.mockResolvedValue(debt);
    givenRows({ otherDebtsOnSource });

    await removeDebtWithRecords(deps, 'user-1', 'debt-1');

    const remainingCall = managerQuery.mock.calls.find(([sql]: [string]) =>
      sql.includes('debt_id = $1 OR id = ANY'),
    ) as [string, [string, string[]]];
    expect(remainingCall[1][1]).toEqual(expected);
  });

  it('отказ отмены общего расчёта (409) уходит наружу: долг не удаляется', async () => {
    givenRows({ settlements: [{ settlement_id: 's-offset', shared: true }] });
    reverse.mockRejectedValue(
      new ConflictException('Сначала отмените более поздний расчёт по долгу «Тимур»'),
    );

    await expect(removeDebtWithRecords(deps, 'user-1', 'debt-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(debtRepository.delete).not.toHaveBeenCalled();
  });
});
