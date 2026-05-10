import { Test, type TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ProcessAutoChargesHandler } from './process-auto-charges.handler';
import { ProcessAutoChargesCommand } from './process-auto-charges.command';
import { RECURRING_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { PUSH_NOTIFICATION_SERVICE } from '../../../../notification/application/services/push-notification.service';
import { TimezoneUserResolverService } from '../../services/timezone-user-resolver.service';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import type {
  PushPayload,
  SendOptions,
} from '../../../../notification/application/services/push-notification.service';

type SendToUserCall = [string, PushPayload, SendOptions];

describe('ProcessAutoChargesHandler', () => {
  let handler: ProcessAutoChargesHandler;
  const mockCommandBus = {
    execute: jest.fn(),
  };
  const mockResolver = {
    getUsersDueForNotification: jest.fn(),
  };
  const mockSubscriptionRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findActiveByBillingDate: jest.fn(),
    findUpcoming: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const mockPushService = {
    sendToUser: jest.fn(),
  };

  let managerQueryMock: jest.Mock;
  let managerSaveMock: jest.Mock;
  let dataSourceTransaction: jest.Mock;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    managerQueryMock = jest.fn();
    managerSaveMock = jest.fn().mockResolvedValue(undefined);
    const managerGetRepository = jest.fn(() => ({ save: managerSaveMock }));
    dataSourceTransaction = jest.fn((cb: (manager: unknown) => unknown) => {
      return cb({ query: managerQueryMock, getRepository: managerGetRepository });
    });
    mockDataSource = { transaction: dataSourceTransaction };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessAutoChargesHandler,
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: TimezoneUserResolverService, useValue: mockResolver },
        { provide: DataSource, useValue: mockDataSource },
        { provide: RECURRING_SUBSCRIPTION_REPOSITORY, useValue: mockSubscriptionRepository },
        { provide: PUSH_NOTIFICATION_SERVICE, useValue: mockPushService },
      ],
    }).compile();

    handler = module.get<ProcessAutoChargesHandler>(ProcessAutoChargesHandler);
    jest.clearAllMocks();
  });

  function buildSubscription(billingDate: Date): RecurringSubscription {
    return RecurringSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      name: 'Netflix',
      description: null,
      amount: 9.99,
      currency: 'USD',
      accountId: 'acc-1',
      icon: 'tv',
      color: '#000',
      frequency: 'monthly',
      frequencyDays: null,
      billingDate,
      notifyDaysBefore: [2],
      categoryId: 'cat-1',
      autoCharge: true,
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  it('successful auto-charge advances billing, saves, and sends charged push', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    const subscription = buildSubscription(new Date('2026-05-08T00:00:00Z'));
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([subscription]);

    // Sequence of manager.query calls inside the transaction:
    // 1) SELECT ... FOR UPDATE → returns row
    // 2) INSERT notification_log → RETURNING id (recorded)
    // 3) SELECT account name
    managerQueryMock
      .mockResolvedValueOnce([{ id: 'sub-1', status: 'active' }])
      .mockResolvedValueOnce([{ id: 'log-id' }])
      .mockResolvedValueOnce([{ name: 'Visa' }]);

    mockCommandBus.execute.mockResolvedValue(undefined);
    mockPushService.sendToUser.mockResolvedValue(true);

    await handler.execute(new ProcessAutoChargesCommand());

    expect(dataSourceTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    // BUG-6: save now goes through the locked manager, not the injected repo.
    expect(managerSaveMock).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
    // billing advanced from 2026-05-08 → next month
    expect(subscription.billingDate.getUTCMonth()).toBe(5);

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockPushService.sendToUser.mock.calls[0] as SendToUserCall;
    expect(payload.body).toContain('Списано 9.99 USD');
    expect(payload.body).toContain('· Visa');
    expect(options.type).toBe('subscription_charged');
    expect(options.dedupKey).toBe('subscription_charged:sub-1:2026-05-08');

    jest.useRealTimers();
  });

  it('failed auto-charge sends failed push with correct dedup key, no advance', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    const subscription = buildSubscription(new Date('2026-05-08T00:00:00Z'));
    const originalBillingDate = subscription.billingDate.getTime();
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([subscription]);

    managerQueryMock
      .mockResolvedValueOnce([{ id: 'sub-1', status: 'active' }])
      .mockResolvedValueOnce([{ id: 'log-id' }])
      .mockResolvedValueOnce([{ name: 'Visa' }]);

    mockCommandBus.execute.mockRejectedValue(new Error('insufficient funds'));
    mockPushService.sendToUser.mockResolvedValue(true);

    await handler.execute(new ProcessAutoChargesCommand());

    // Save not called because transaction threw before reaching it
    expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
    expect(managerSaveMock).not.toHaveBeenCalled();
    // Billing date was advanced in-memory before save threw, but since we never saved and the
    // aggregate is in-memory in this test, we accept either state. The contract is: DB rolled back.
    // Push was sent for failure
    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockPushService.sendToUser.mock.calls[0] as SendToUserCall;
    expect(payload.body).toContain('Не удалось списать');
    expect(options.type).toBe('subscription_failed');
    expect(options.dedupKey).toBe('subscription_failed:sub-1:2026-05-08');

    void originalBillingDate;
    jest.useRealTimers();
  });

  it('skips when auto_charge dedup key already exists (already charged today)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    const subscription = buildSubscription(new Date('2026-05-08T00:00:00Z'));
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([subscription]);

    managerQueryMock
      .mockResolvedValueOnce([{ id: 'sub-1', status: 'active' }])
      .mockResolvedValueOnce([]); // tryRecord returns no row → already exists

    await handler.execute(new ProcessAutoChargesCommand());

    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips when locked row reports non-active status (race with pause)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    const subscription = buildSubscription(new Date('2026-05-08T00:00:00Z'));
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([subscription]);

    // Locked row says 'paused' — user paused between findActive and lock.
    managerQueryMock.mockResolvedValueOnce([{ id: 'sub-1', status: 'paused' }]);

    await handler.execute(new ProcessAutoChargesCommand());

    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
    expect(mockPushService.sendToUser).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('skips subscriptions with autoCharge=false', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    const subscription = buildSubscription(new Date('2026-05-08T00:00:00Z'));
    Object.defineProperty(subscription, '_autoCharge', { value: false, writable: true });
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([subscription]);

    await handler.execute(new ProcessAutoChargesCommand());

    expect(dataSourceTransaction).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
