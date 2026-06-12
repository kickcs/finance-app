import { Test, type TestingModule } from '@nestjs/testing';
import { IngestBankMessageHandler } from './ingest-bank-message.handler';
import { IngestBankMessageCommand } from './ingest-bank-message.command';
import { TELEGRAM_LINK_REPOSITORY } from '../../../domain/repositories/telegram-link.repository.interface';
import {
  IMPORTED_TRANSACTION_REPOSITORY,
  type ImportedTransactionCreate,
} from '../../../domain/repositories/imported-transaction.repository.interface';

const PAYMENT = `💸 Оплата
➖ 1.700,00 UZS
📍 TRANSPORT TOLOV>TOS
💳 HUMOCARD *1951
🕓 22:11 12.06.2026
💰 12.543.101,08 UZS`;

const BALANCE_CHANGE = `ℹ️ Счет по карте изменен
💸 13.244.800,00 UZS
💳 HUMO-CARD *1951
🕘 15:39 12.06.2026`;

describe('IngestBankMessageHandler', () => {
  let handler: IngestBankMessageHandler;
  const linkRepo = {
    findByUserId: jest.fn(),
    findByTelegramUserId: jest.fn(),
    save: jest.fn(),
    deleteByUserId: jest.fn(),
  };
  const importedRepo = {
    insertIfNew: jest.fn(),
    findById: jest.fn(),
    findPendingWithSuggestions: jest.fn(),
    countPending: jest.fn(),
    markConfirmed: jest.fn(),
    markDismissed: jest.fn(),
    findLatestBalance: jest.fn(),
    findTransferCounterpart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestBankMessageHandler,
        { provide: TELEGRAM_LINK_REPOSITORY, useValue: linkRepo },
        { provide: IMPORTED_TRANSACTION_REPOSITORY, useValue: importedRepo },
      ],
    }).compile();
    handler = module.get(IngestBankMessageHandler);
    jest.clearAllMocks();
  });

  it('not_linked, если telegram-аккаунт не привязан', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue(null);
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('not_linked');
  });

  it('imported: парсит и сохраняет', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-1' });
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('imported');
    const arg = (importedRepo.insertIfNew.mock.calls as ImportedTransactionCreate[][])[0][0];
    expect(arg).toMatchObject({
      userId: 'user-1',
      type: 'expense',
      amount: 1700,
      cardMask: '*1951',
    });
    expect(arg.dedupHash).toHaveLength(64);
  });

  it('duplicate при конфликте dedup', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue(null);
    expect(await handler.execute(new IngestBankMessageCommand('42', PAYMENT))).toBe('duplicate');
  });

  it('unparsed: сохраняет raw с type=unparsed', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-2' });
    expect(await handler.execute(new IngestBankMessageCommand('42', 'просто текст'))).toBe(
      'unparsed',
    );
    expect(
      (importedRepo.insertIfNew.mock.calls as ImportedTransactionCreate[][])[0][0],
    ).toMatchObject({
      type: 'unparsed',
      amount: null,
    });
  });

  it('balance_change: amount = дельта от последнего баланса карты', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.findLatestBalance.mockResolvedValue(887801.08);
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-3' });
    await handler.execute(new IngestBankMessageCommand('42', BALANCE_CHANGE));
    const arg = (importedRepo.insertIfNew.mock.calls as ImportedTransactionCreate[][])[0][0];
    expect(arg.type).toBe('balance_change');
    expect(arg.amount).toBeCloseTo(13244800 - 887801.08, 2);
    expect(importedRepo.findLatestBalance).toHaveBeenCalledWith(
      'user-1',
      '*1951',
      expect.any(Date),
    );
  });

  it('balance_change без предыдущего баланса: amount = null', async () => {
    linkRepo.findByTelegramUserId.mockResolvedValue({ userId: 'user-1' });
    importedRepo.findLatestBalance.mockResolvedValue(null);
    importedRepo.insertIfNew.mockResolvedValue({ id: 'imp-4' });
    await handler.execute(new IngestBankMessageCommand('42', BALANCE_CHANGE));
    expect(
      (importedRepo.insertIfNew.mock.calls as ImportedTransactionCreate[][])[0][0].amount,
    ).toBeNull();
  });
});
