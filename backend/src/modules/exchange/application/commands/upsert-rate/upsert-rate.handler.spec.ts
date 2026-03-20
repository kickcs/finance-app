import { Test, type TestingModule } from '@nestjs/testing';
import { UpsertRateHandler } from './upsert-rate.handler';
import { UpsertRateCommand } from './upsert-rate.command';
import { EXCHANGE_RATE_REPOSITORY } from '../../../domain/repositories';
import { EXCHANGE_RATE_CACHE } from '../../services/exchange-rate-cache.service';

describe('UpsertRateHandler', () => {
  let handler: UpsertRateHandler;
  const mockRepository = {
    findByPair: jest.fn(),
    findAll: jest.fn(),
    findByBaseCurrency: jest.fn(),
    findByTargetCurrency: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    saveMany: jest.fn(),
  };
  const mockCache = {
    get: jest.fn(),
    resolve: jest.fn(),
    getAll: jest.fn(),
    set: jest.fn(),
    reload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertRateHandler,
        { provide: EXCHANGE_RATE_REPOSITORY, useValue: mockRepository },
        { provide: EXCHANGE_RATE_CACHE, useValue: mockCache },
      ],
    }).compile();

    handler = module.get<UpsertRateHandler>(UpsertRateHandler);
    jest.clearAllMocks();
  });

  it('should create a new exchange rate and cache it', async () => {
    mockRepository.save.mockImplementation((rate) => Promise.resolve(rate));

    const command = new UpsertRateCommand('USD', 'EUR', 0.85);

    const result = await handler.execute(command);

    expect(result.baseCurrency).toBe('USD');
    expect(result.targetCurrency).toBe('EUR');
    expect(result.rate).toBe(0.85);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledTimes(1);
  });

  it('should handle different currency pairs', async () => {
    mockRepository.save.mockImplementation((rate) => Promise.resolve(rate));

    const command = new UpsertRateCommand('USD', 'UZS', 12500);

    const result = await handler.execute(command);

    expect(result.baseCurrency).toBe('USD');
    expect(result.targetCurrency).toBe('UZS');
    expect(result.rate).toBe(12500);
  });

  it('should normalize currency codes to uppercase', async () => {
    mockRepository.save.mockImplementation((rate) => Promise.resolve(rate));

    const command = new UpsertRateCommand('usd', 'eur', 0.85);

    const result = await handler.execute(command);

    expect(result.baseCurrency).toBe('USD');
    expect(result.targetCurrency).toBe('EUR');
  });

  it('should throw error for zero rate', async () => {
    const command = new UpsertRateCommand('USD', 'EUR', 0);

    await expect(handler.execute(command)).rejects.toThrow(
      'Exchange rate must be greater than zero',
    );
  });

  it('should throw error for negative rate', async () => {
    const command = new UpsertRateCommand('USD', 'EUR', -1);

    await expect(handler.execute(command)).rejects.toThrow(
      'Exchange rate must be greater than zero',
    );
  });

  it('should throw error for same currency', async () => {
    const command = new UpsertRateCommand('USD', 'USD', 1);

    await expect(handler.execute(command)).rejects.toThrow(
      'Base and target currencies must be different',
    );
  });
});
