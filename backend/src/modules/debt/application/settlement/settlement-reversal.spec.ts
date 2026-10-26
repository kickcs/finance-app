import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import type { DataSource, EntityManager } from 'typeorm';
import { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';
import type { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';
import {
  deleteRecords,
  reopenClosedDebt,
  reverseSettlement,
  revertAmounts,
  type SettlementRecord,
} from './settlement-reversal';

const record = (
  overrides: Partial<SettlementRecord> & Pick<SettlementRecord, 'id' | 'categoryId'>,
): SettlementRecord => ({ userId: 'user-1', debtId: 'debt-1', amount: 100, ...overrides });

describe('revertAmounts', () => {
  it('считает возвраты, зачёты и отметки отработки погашением, а debt_forgiven — прощением', () => {
    const records = [
      record({ id: 'a', categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME, amount: 100 }),
      record({ id: 'b', categoryId: DEBT_CATEGORY_IDS.RETURN_FROM_ME, amount: 20 }),
      record({ id: 'c', categoryId: DEBT_CATEGORY_IDS.OFFSET, amount: 30 }),
      record({ id: 'd', categoryId: DEBT_CATEGORY_IDS.WORKED_OFF, amount: 40 }),
      record({ id: 'e', categoryId: DEBT_CATEGORY_IDS.FORGIVEN, amount: 200 }),
    ];

    expect(revertAmounts(records, 'debt-1')).toEqual({ applied: 190, forgiven: 200 });
  });

  it('нога работы и переплата не уменьшали остаток и не считаются', () => {
    const records = [
      record({ id: 'work', categoryId: 'other_expense', amount: 300 }),
      record({ id: 'back', categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME, amount: 300 }),
      record({ id: 'excess', categoryId: 'other_income', amount: 50, debtId: null }),
    ];

    expect(revertAmounts(records, 'debt-1')).toEqual({ applied: 300, forgiven: 0 });
  });

  it('считает отдельно по каждому долгу расчёта', () => {
    const records = [
      record({ id: 'a', categoryId: DEBT_CATEGORY_IDS.OFFSET, amount: 200, debtId: 'debt-1' }),
      record({ id: 'b', categoryId: DEBT_CATEGORY_IDS.OFFSET, amount: 50, debtId: 'debt-2' }),
    ];

    expect(revertAmounts(records, 'debt-1').applied).toBe(200);
    expect(revertAmounts(records, 'debt-2').applied).toBe(50);
  });

  it('округляет до копеек', () => {
    const records = [
      record({ id: 'a', categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME, amount: 0.1 }),
      record({ id: 'b', categoryId: DEBT_CATEGORY_IDS.OFFSET, amount: 0.2 }),
    ];

    expect(revertAmounts(records, 'debt-1').applied).toBe(0.3);
  });
});

describe('reverseSettlement', () => {
  const calls: string[] = [];
  const managerQuery = jest.fn();
  const manager = { query: managerQuery } as unknown as EntityManager;
  const debtRepository = { findById: jest.fn(), findByIdsForUpdate: jest.fn(), save: jest.fn() };
  const commandBus = { execute: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const deps = {
    debtRepository: debtRepository as unknown as IDebtRepository,
    commandBus: commandBus as unknown as CommandBus,
    dataSource: dataSource as unknown as DataSource,
  };

  const row = (
    id: string,
    category: string,
    debtId: string | null,
    amount: string,
    user = 'user-1',
  ) => ({ id, user_id: user, debt_id: debtId, category_id: category, amount });

  const closedDebt = (id: string, name: string, total: number) => {
    const debt = Debt.create({
      id,
      userId: 'user-1',
      name,
      totalAmount: total,
      currency: 'UZS',
      debtType: 'given',
      personName: name,
    });
    debt.makePayment(total);
    debt.setCloseTransactionId('close-tx');
    return debt;
  };

  /** Ответы менеджера по тексту запроса: порядок запросов в тесте не зашит, но виден в `calls`. */
  const answers = {
    debtIds: [] as string[],
    records: [] as unknown[],
    /** Долги, у которых есть более поздний расчёт. */
    later: [] as string[],
    /** Долги пользователя, которые отдаёт замок; id вне этого списка замок не возвращает. */
    locked: [] as Debt[],
  };

  beforeEach(() => {
    calls.length = 0;
    answers.debtIds = [];
    answers.records = [];
    answers.later = [];
    answers.locked = [];
    jest.resetAllMocks();
    managerQuery.mockImplementation((sql: string) => {
      if (sql.includes('settlement_id <>')) {
        return Promise.resolve(answers.later.map((debt_id) => ({ debt_id })));
      }
      if (sql.includes('SELECT DISTINCT debt_id')) {
        return Promise.resolve(answers.debtIds.map((debt_id) => ({ debt_id })));
      }
      if (sql.includes('FOR UPDATE')) {
        calls.push('records');
        return Promise.resolve(answers.records);
      }
      return Promise.resolve([]);
    });
    debtRepository.findByIdsForUpdate.mockImplementation((ids: string[]) => {
      if (ids.length === 0) return Promise.resolve([]);
      calls.push(`lock:${ids.join(',')}`);
      return Promise.resolve(answers.locked.filter((debt) => ids.includes(debt.id)));
    });
    debtRepository.save.mockImplementation((debt: Debt) => {
      calls.push(`save:${debt.id}`);
      return Promise.resolve(debt);
    });
    commandBus.execute.mockImplementation((command: DeleteTransactionCommand) => {
      calls.push(`delete:${command.id}`);
      return Promise.resolve();
    });
    dataSource.transaction.mockImplementation((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    );
  });

  it('без менеджера открывает одну транзакцию БД и работает внутри неё', async () => {
    await expect(reverseSettlement(deps, 'user-1', 's-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['records']);
  });

  it('с менеджером своей транзакции не открывает', async () => {
    await expect(reverseSettlement(deps, 'user-1', 's-1', manager)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('запись другого пользователя — 403, ничего не тронуто', async () => {
    answers.records = [row('r-1', DEBT_CATEGORY_IDS.RETURN_TO_ME, 'debt-1', '100', 'user-2')];

    await expect(reverseSettlement(deps, 'user-1', 's-1', manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(debtRepository.save).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('более поздний расчёт у любого из долгов — 409 с его именем до первой правки', async () => {
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.OFFSET, 'debt-1', '100'),
      row('r-2', DEBT_CATEGORY_IDS.OFFSET, 'debt-2', '100'),
    ];
    answers.later = ['debt-2']; // у debt-1 более позднего расчёта нет, у debt-2 есть
    answers.debtIds = ['debt-1', 'debt-2'];
    answers.locked = [closedDebt('debt-1', 'Первый', 100), closedDebt('debt-2', 'Второй', 100)];

    const attempt = reverseSettlement(deps, 'user-1', 's-1', manager);

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'Сначала отмените более поздний расчёт по долгу «Второй»',
    );
    expect(debtRepository.save).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('при нескольких блокирующих долгах называет первый в порядке записей расчёта', async () => {
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.OFFSET, 'debt-1', '100'),
      row('r-2', DEBT_CATEGORY_IDS.OFFSET, 'debt-2', '100'),
    ];
    answers.later = ['debt-2', 'debt-1'];
    answers.debtIds = ['debt-1', 'debt-2'];
    answers.locked = [closedDebt('debt-1', 'Первый', 100), closedDebt('debt-2', 'Второй', 100)];

    await expect(reverseSettlement(deps, 'user-1', 's-1', manager)).rejects.toThrow(
      'Сначала отмените более поздний расчёт по долгу «Первый»',
    );
  });

  it('порядок расчётов проверяет одним запросом на все долги', async () => {
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.OFFSET, 'debt-1', '100'),
      row('r-2', DEBT_CATEGORY_IDS.OFFSET, 'debt-2', '100'),
    ];
    answers.debtIds = ['debt-1', 'debt-2'];
    answers.locked = [closedDebt('debt-1', 'Первый', 100), closedDebt('debt-2', 'Второй', 100)];

    await reverseSettlement(deps, 'user-1', 's-1', manager);

    const orderChecks = (managerQuery.mock.calls as [string, unknown[]][]).filter(([sql]) =>
      sql.includes('settlement_id <>'),
    );
    expect(orderChecks).toHaveLength(1);
    expect(orderChecks[0][1]).toEqual([['debt-1', 'debt-2'], 's-1']);
  });

  it('сохраняет долги раньше удаления записей и удаляет каждую запись через менеджер', async () => {
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.RETURN_TO_ME, 'debt-1', '350'),
      row('r-2', 'other_income', null, '50'),
    ];
    answers.debtIds = ['debt-1'];
    answers.locked = [closedDebt('debt-1', 'Тимур', 350)];

    const debts = await reverseSettlement(deps, 'user-1', 's-1', manager);

    expect(calls.filter((c) => !c.startsWith('lock') && c !== 'records')).toEqual([
      'save:debt-1',
      'delete:r-1',
      'delete:r-2',
    ]);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({ isClosed: false, closeTransactionId: null });
    expect(debts[0].remainingAmountValue).toBe(350);
    const [deleteCommand] = commandBus.execute.mock.calls[0] as [DeleteTransactionCommand];
    expect(deleteCommand).toMatchObject({ id: 'r-1', userId: 'user-1', skipDebtCheck: true });
    expect(deleteCommand.manager).toBe(manager);
    // Долги берутся из замка, а не читаются заново по одному.
    expect(debtRepository.findById).not.toHaveBeenCalled();
    expect(debtRepository.save).toHaveBeenCalledWith(expect.anything(), manager);
  });

  it('запирает долги расчёта раньше, чем читает его записи', async () => {
    answers.debtIds = ['debt-2', 'debt-1'];
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.OFFSET, 'debt-1', '100'),
      row('r-2', DEBT_CATEGORY_IDS.OFFSET, 'debt-2', '100'),
    ];
    answers.locked = [closedDebt('debt-1', 'debt-1', 100), closedDebt('debt-2', 'debt-2', 100)];

    await reverseSettlement(deps, 'user-1', 's-1', manager);

    expect(calls.slice(0, 2)).toEqual(['lock:debt-2,debt-1', 'records']);
    expect(debtRepository.findByIdsForUpdate).toHaveBeenCalledWith(
      ['debt-2', 'debt-1'],
      'user-1',
      manager,
    );
  });

  it('долг, которого нет под замком, пропускается: остальное снимается, перечитывать нечего', async () => {
    answers.debtIds = ['debt-1'];
    answers.records = [
      row('r-1', DEBT_CATEGORY_IDS.RETURN_TO_ME, 'debt-1', '100'),
      row('r-2', 'other_income', null, '50'),
    ];

    const debts = await reverseSettlement(deps, 'user-1', 's-1', manager);

    expect(debts).toEqual([]);
    expect(debtRepository.findById).not.toHaveBeenCalled();
    expect(debtRepository.save).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.startsWith('delete:'))).toEqual(['delete:r-1', 'delete:r-2']);
  });
});

describe('deleteRecords', () => {
  it('снимает записи по одной через менеджер, в заданном порядке и без проверки долга', async () => {
    const manager = {} as EntityManager;
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };

    await deleteRecords(
      { commandBus: commandBus as unknown as CommandBus },
      'user-1',
      ['a', 'b'],
      manager,
    );

    const commands = commandBus.execute.mock.calls.map(
      ([command]) => command as DeleteTransactionCommand,
    );
    expect(commands.map((c) => c.id)).toEqual(['a', 'b']);
    for (const command of commands) {
      expect(command).toMatchObject({ userId: 'user-1', skipDebtCheck: true });
      expect(command.manager).toBe(manager);
    }
  });
});

describe('reopenClosedDebt', () => {
  const managerQuery = jest.fn();
  const manager = { query: managerQuery } as unknown as EntityManager;
  const debtRepository = { findById: jest.fn(), findByIdsForUpdate: jest.fn(), save: jest.fn() };
  const commandBus = { execute: jest.fn() };
  const dataSource = {
    transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
  };
  const deps = {
    debtRepository: debtRepository as unknown as IDebtRepository,
    commandBus: commandBus as unknown as CommandBus,
    dataSource: dataSource as unknown as DataSource,
  };

  const closedDebt = (id: string, closeTransactionId: string) => {
    const debt = Debt.create({
      id,
      userId: 'user-1',
      name: 'Тимур',
      totalAmount: 100,
      currency: 'UZS',
      debtType: 'given',
      personName: 'Тимур',
    });
    debt.makePayment(100);
    debt.setCloseTransactionId(closeTransactionId);
    return debt;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    dataSource.transaction.mockImplementation((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    );
    debtRepository.save.mockImplementation((debt: Debt) => Promise.resolve(debt));
    commandBus.execute.mockResolvedValue(undefined);
  });

  it('закрытие расчётом: возвращает долг из отмены, не перечитывая его', async () => {
    const debt = closedDebt('debt-1', 'close-tx');
    debtRepository.findById.mockResolvedValue(debt);
    debtRepository.findByIdsForUpdate.mockResolvedValue([debt]);
    managerQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT settlement_id FROM transactions WHERE id')) {
        return Promise.resolve([{ settlement_id: 's-1' }]);
      }
      if (sql.includes('settlement_id <>')) return Promise.resolve([]);
      if (sql.includes('SELECT DISTINCT debt_id')) return Promise.resolve([{ debt_id: 'debt-1' }]);
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve([
          {
            id: 'close-tx',
            user_id: 'user-1',
            debt_id: 'debt-1',
            category_id: DEBT_CATEGORY_IDS.RETURN_TO_ME,
            amount: '100',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const reopened = await reopenClosedDebt(deps, 'user-1', 'debt-1');

    expect(reopened).toMatchObject({ id: 'debt-1', isClosed: false });
    expect(reopened.remainingAmountValue).toBe(100);
    // Одно чтение до отмены (проверить, что долг закрыт); после неё — только то, что вернула отмена.
    expect(debtRepository.findById).toHaveBeenCalledTimes(1);
  });

  it('закрытие без расчёта: долг запирается и берётся из замка', async () => {
    debtRepository.findById.mockResolvedValue(closedDebt('debt-1', 'legacy-tx'));
    debtRepository.findByIdsForUpdate.mockResolvedValue([closedDebt('debt-1', 'legacy-tx')]);
    managerQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT settlement_id FROM transactions WHERE id')) {
        return Promise.resolve([{ settlement_id: null }]);
      }
      if (sql.includes('SUM(amount)')) return Promise.resolve([{ applied: '40' }]);
      return Promise.resolve([]);
    });

    const reopened = await reopenClosedDebt(deps, 'user-1', 'debt-1');

    expect(debtRepository.findByIdsForUpdate).toHaveBeenCalledWith(['debt-1'], 'user-1', manager);
    expect(debtRepository.findById).toHaveBeenCalledTimes(1);
    expect(reopened).toMatchObject({ isClosed: false });
    expect(reopened.remainingAmountValue).toBe(60);
  });

  it('долг не найден — 404, чужой — 403, открытый — 409', async () => {
    debtRepository.findById.mockResolvedValueOnce(null);
    await expect(reopenClosedDebt(deps, 'user-1', 'debt-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    debtRepository.findById.mockResolvedValueOnce(closedDebt('debt-1', 'x'));
    await expect(reopenClosedDebt(deps, 'user-2', 'debt-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const open = closedDebt('debt-1', 'x');
    open.reopenWithRemaining(100);
    debtRepository.findById.mockResolvedValueOnce(open);
    await expect(reopenClosedDebt(deps, 'user-1', 'debt-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
