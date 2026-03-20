import { Test, type TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { SyncRatesHandler } from './sync-rates.handler';
import { SyncRatesCommand } from './sync-rates.command';
import { EXCHANGE_RATE_PROVIDER } from '../../../infrastructure/external';

describe('SyncRatesHandler', () => {
  let handler: SyncRatesHandler;
  const mockProvider = {
    fetchRates: jest.fn(),
  };
  const mockCommandBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncRatesHandler,
        { provide: EXCHANGE_RATE_PROVIDER, useValue: mockProvider },
        { provide: CommandBus, useValue: mockCommandBus },
      ],
    }).compile();

    handler = module.get<SyncRatesHandler>(SyncRatesHandler);
    jest.clearAllMocks();
  });

  it('should fetch rates and upsert each one', async () => {
    const rates = [
      { baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.85, date: new Date() },
      { baseCurrency: 'USD', targetCurrency: 'GBP', rate: 0.79, date: new Date() },
      { baseCurrency: 'USD', targetCurrency: 'RUB', rate: 91.5, date: new Date() },
    ];
    mockProvider.fetchRates.mockResolvedValue(rates);
    mockCommandBus.execute.mockResolvedValue(undefined);

    const command = new SyncRatesCommand('USD');

    await handler.execute(command);

    expect(mockProvider.fetchRates).toHaveBeenCalledWith(
      'USD',
      expect.arrayContaining(['EUR', 'GBP', 'RUB', 'UZS', 'CNY', 'KZT']),
    );
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
  });

  it('should handle empty rates from provider', async () => {
    mockProvider.fetchRates.mockResolvedValue([]);

    const command = new SyncRatesCommand('EUR');

    await handler.execute(command);

    expect(mockProvider.fetchRates).toHaveBeenCalledWith('EUR', expect.any(Array));
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });

  it('should throw when provider fails', async () => {
    mockProvider.fetchRates.mockRejectedValue(new Error('API unavailable'));

    const command = new SyncRatesCommand('USD');

    await expect(handler.execute(command)).rejects.toThrow('API unavailable');
  });
});
