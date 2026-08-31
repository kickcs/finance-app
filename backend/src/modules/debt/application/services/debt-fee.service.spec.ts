import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DebtFeeService } from './debt-fee.service';
import { Debt } from '../../domain/aggregates/debt';
import { CreateTransactionCommand } from '../../../accounting/application/commands/create-transaction/create-transaction.command';
import { UpdateTransactionCommand } from '../../../accounting/application/commands/update-transaction/update-transaction.command';
import { DeleteTransactionCommand } from '../../../accounting/application/commands/delete-transaction/delete-transaction.command';

describe('DebtFeeService', () => {
  let service: DebtFeeService;
  const mockCommandBus = { execute: jest.fn() };

  /** Аргумент n-й отправленной команды. */
  function commandArg(nth: number): unknown {
    return (mockCommandBus.execute.mock.calls as unknown[][])[nth][0];
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DebtFeeService, { provide: CommandBus, useValue: mockCommandBus }],
    }).compile();

    service = module.get(DebtFeeService);
    jest.clearAllMocks();
    mockCommandBus.execute.mockResolvedValue({ id: 'tx-fee' });
  });

  function createDebt(accountId: string | null = 'acc-1'): Debt {
    return Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Долг для Алексея',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
      personName: 'Алексей',
      accountId: accountId ?? undefined,
    });
  }

  it('заводит расход-комиссию и запоминает его на долге', async () => {
    const debt = createDebt();

    await service.apply(debt, 50);

    const command = commandArg(0) as CreateTransactionCommand;
    expect(command).toBeInstanceOf(CreateTransactionCommand);
    expect(command.amount).toBe(50);
    expect(command.categoryId).toBe('commission');
    expect(command.type).toBe('expense');
    expect(command.accountId).toBe('acc-1');
    // Не долговая и без debtId — иначе комиссия читалась бы как возврат долга
    expect(command.isDebtRelated).toBe(false);
    expect(command.debtId).toBeUndefined();

    expect(debt.feeAmount).toBe(50);
    expect(debt.feeTransactionId).toBe('tx-fee');
  });

  it('правит сумму уже заведённой записи', async () => {
    const debt = createDebt();
    debt.setFee(50, 'tx-fee');

    await service.apply(debt, 80);

    const command = commandArg(0) as UpdateTransactionCommand;
    expect(command).toBeInstanceOf(UpdateTransactionCommand);
    expect(command.id).toBe('tx-fee');
    expect(command.data.amount).toBe(80);
    expect(debt.feeAmount).toBe(80);
    expect(debt.feeTransactionId).toBe('tx-fee');
  });

  it('обнулённая комиссия убирает запись', async () => {
    const debt = createDebt();
    debt.setFee(50, 'tx-fee');

    await service.apply(debt, 0);

    expect(commandArg(0)).toBeInstanceOf(DeleteTransactionCommand);
    expect(debt.feeAmount).toBe(0);
    expect(debt.feeTransactionId).toBeNull();
  });

  it('та же сумма ничего не трогает', async () => {
    const debt = createDebt();
    debt.setFee(50, 'tx-fee');

    await service.apply(debt, 50);

    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });

  it('комиссию без своей записи править нельзя', async () => {
    const debt = createDebt();
    // Долг из времён, когда комиссию заводил POST /transactions
    debt.setFee(50, null);

    await expect(service.apply(debt, 80)).rejects.toThrow(BadRequestException);
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });

  it('без счёта комиссию списывать не с чего', async () => {
    const debt = createDebt(null);

    await expect(service.apply(debt, 50)).rejects.toThrow(BadRequestException);
  });

  it('передаёт внешний менеджер, чтобы запись легла в общую транзакцию', async () => {
    const debt = createDebt();
    const manager = {} as never;

    await service.apply(debt, 50, manager);

    const command = commandArg(0) as CreateTransactionCommand;
    expect(command.manager).toBe(manager);
  });
});
