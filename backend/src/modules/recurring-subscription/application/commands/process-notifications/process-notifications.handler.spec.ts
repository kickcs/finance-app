import { Test, type TestingModule } from '@nestjs/testing';
import { ProcessNotificationsHandler } from './process-notifications.handler';
import { ProcessNotificationsCommand } from './process-notifications.command';
import { RECURRING_SUBSCRIPTION_REPOSITORY } from '../../../domain/repositories';
import { PUSH_NOTIFICATION_SERVICE } from '../../../../notification/application/services/push-notification.service';
import { TimezoneUserResolverService } from '../../services/timezone-user-resolver.service';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import type {
  PushPayload,
  SendOptions,
} from '../../../../notification/application/services/push-notification.service';

type SendToUserCall = [string, PushPayload, SendOptions];

describe('ProcessNotificationsHandler', () => {
  let handler: ProcessNotificationsHandler;
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessNotificationsHandler,
        { provide: TimezoneUserResolverService, useValue: mockResolver },
        { provide: RECURRING_SUBSCRIPTION_REPOSITORY, useValue: mockSubscriptionRepository },
        { provide: PUSH_NOTIFICATION_SERVICE, useValue: mockPushService },
      ],
    }).compile();

    handler = module.get<ProcessNotificationsHandler>(ProcessNotificationsHandler);
    jest.clearAllMocks();
  });

  function buildSubscription(billingDate: Date, notifyDaysBefore: number[]): RecurringSubscription {
    return RecurringSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      name: 'Netflix',
      description: null,
      amount: 9.99,
      currency: 'USD',
      accountId: null,
      icon: 'tv',
      color: '#000',
      frequency: 'monthly',
      frequencyDays: null,
      billingDate,
      notifyDaysBefore,
      categoryId: 'cat-1',
      autoCharge: false,
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  it('sends notification when daysBefore=2 matches today', async () => {
    // todayInTz=2026-05-08 (UTC tz), billingDate=2026-05-10 → daysBefore=2 matches
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([
      buildSubscription(new Date('2026-05-10T00:00:00Z'), [2]),
    ]);
    mockPushService.sendToUser.mockResolvedValue(true);

    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));

    await handler.execute(new ProcessNotificationsCommand());

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockPushService.sendToUser.mock.calls[0] as SendToUserCall;
    expect(payload.body).toContain('через 2 дн.');
    expect(options.type).toBe('subscription_upcoming');
    expect(options.dedupKey).toBe('subscription_upcoming:sub-1:2026-05-08:2');

    jest.useRealTimers();
  });

  it('multi-element notifyDaysBefore [3, 1, 0] only triggers matching days', async () => {
    // billing=2026-05-09. Today=2026-05-08 → daysBefore=1 matches. 3 and 0 do not.
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([
      buildSubscription(new Date('2026-05-09T00:00:00Z'), [3, 1, 0]),
    ]);
    mockPushService.sendToUser.mockResolvedValue(true);

    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));

    await handler.execute(new ProcessNotificationsCommand());

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, payload, options] = mockPushService.sendToUser.mock.calls[0] as SendToUserCall;
    expect(payload.body).toContain('завтра');
    expect(options.dedupKey).toBe('subscription_upcoming:sub-1:2026-05-08:1');

    jest.useRealTimers();
  });

  it('sends nothing when notifyDaysBefore is empty', async () => {
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([
      buildSubscription(new Date('2026-05-10T00:00:00Z'), []),
    ]);

    await handler.execute(new ProcessNotificationsCommand());

    expect(mockPushService.sendToUser).not.toHaveBeenCalled();
  });

  it('sends "сегодня" when daysBefore=0 matches today', async () => {
    mockResolver.getUsersDueForNotification.mockResolvedValue([
      { userId: 'user-1', timezone: 'UTC', notificationHour: 12 },
    ]);
    mockSubscriptionRepository.findActiveByUserId.mockResolvedValue([
      buildSubscription(new Date('2026-05-08T00:00:00Z'), [0]),
    ]);
    mockPushService.sendToUser.mockResolvedValue(true);

    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00Z'));

    await handler.execute(new ProcessNotificationsCommand());

    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    const [, payload] = mockPushService.sendToUser.mock.calls[0] as SendToUserCall;
    expect(payload.body).toContain('сегодня');

    jest.useRealTimers();
  });
});
