import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushNotificationService } from './push-notification.service';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  NOTIFICATION_LOG_REPOSITORY,
  NOTIFICATION_PREFERENCES_REPOSITORY,
} from '../../domain/repositories';
import { PushSubscription } from '../../domain/aggregates/push-subscription';
import { NotificationPreferences } from '../../domain/aggregates/notification-preferences';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webPush from 'web-push';

describe('PushNotificationService', () => {
  const mockSubscriptionRepository = {
    findByUserId: jest.fn(),
    findByEndpoint: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const mockLogRepository = {
    tryRecord: jest.fn(),
    findRecentByUserId: jest.fn(),
  };
  const mockPrefsRepository = {
    findByUserId: jest.fn(),
    save: jest.fn(),
  };

  function buildSubscription(): PushSubscription {
    return PushSubscription.reconstitute({
      id: 'sub-1',
      userId: 'user-1',
      endpoint: 'https://updates.push.services.mozilla.com/abc',
      p256dh: 'p256',
      auth: 'auth',
      userAgent: null,
      createdAt: new Date(),
    });
  }

  async function buildService(vapid = true): Promise<PushNotificationService> {
    const configValues: Record<string, string | undefined> = vapid
      ? {
          VAPID_PUBLIC_KEY: 'pub',
          VAPID_PRIVATE_KEY: 'priv',
          VAPID_SUBJECT: 'mailto:test@example.com',
        }
      : {};
    const mockConfig = {
      get: jest.fn((key: string, defaultVal?: unknown) => configValues[key] ?? defaultVal),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: PUSH_SUBSCRIPTION_REPOSITORY, useValue: mockSubscriptionRepository },
        { provide: NOTIFICATION_LOG_REPOSITORY, useValue: mockLogRepository },
        { provide: NOTIFICATION_PREFERENCES_REPOSITORY, useValue: mockPrefsRepository },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    return module.get<PushNotificationService>(PushNotificationService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when VAPID is not configured', async () => {
    const service = await buildService(false);
    const result = await service.sendToUser('user-1', { title: 't', body: 'b' });
    expect(result).toBe(false);
    expect(mockSubscriptionRepository.findByUserId).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('skips send when dedup log already exists', async () => {
    const service = await buildService(true);
    mockPrefsRepository.findByUserId.mockResolvedValue(null);
    mockLogRepository.tryRecord.mockResolvedValue(false);

    const result = await service.sendToUser(
      'user-1',
      { title: 't', body: 'b' },
      { type: 'subscription_upcoming', dedupKey: 'k1' },
    );

    expect(result).toBe(false);
    expect(mockSubscriptionRepository.findByUserId).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('skips send when preferences disable type', async () => {
    const service = await buildService(true);
    mockPrefsRepository.findByUserId.mockResolvedValue(
      NotificationPreferences.reconstitute({
        userId: 'user-1',
        subscriptionUpcoming: false,
        subscriptionCharged: true,
        subscriptionFailed: true,
        updatedAt: new Date(),
      }),
    );

    const result = await service.sendToUser(
      'user-1',
      { title: 't', body: 'b' },
      { type: 'subscription_upcoming', dedupKey: 'k2' },
    );

    expect(result).toBe(false);
    expect(mockLogRepository.tryRecord).not.toHaveBeenCalled();
    expect(webPush.sendNotification).not.toHaveBeenCalled();
  });

  it('test type bypasses preferences', async () => {
    const service = await buildService(true);
    mockPrefsRepository.findByUserId.mockResolvedValue(
      NotificationPreferences.reconstitute({
        userId: 'user-1',
        subscriptionUpcoming: false,
        subscriptionCharged: false,
        subscriptionFailed: false,
        updatedAt: new Date(),
      }),
    );
    mockLogRepository.tryRecord.mockResolvedValue(true);
    mockSubscriptionRepository.findByUserId.mockResolvedValue([buildSubscription()]);
    (webPush.sendNotification as jest.Mock).mockResolvedValue(undefined);

    const result = await service.sendToUser(
      'user-1',
      { title: 't', body: 'b' },
      { type: 'test', dedupKey: 'kT' },
    );

    expect(result).toBe(true);
    expect(mockPrefsRepository.findByUserId).not.toHaveBeenCalled();
    expect(webPush.sendNotification).toHaveBeenCalled();
  });

  it('successfully sends and returns true', async () => {
    const service = await buildService(true);
    mockSubscriptionRepository.findByUserId.mockResolvedValue([buildSubscription()]);
    (webPush.sendNotification as jest.Mock).mockResolvedValue(undefined);

    const result = await service.sendToUser('user-1', { title: 't', body: 'b' });

    expect(result).toBe(true);
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('deletes subscription on 410 response', async () => {
    const service = await buildService(true);
    const subscription = buildSubscription();
    mockSubscriptionRepository.findByUserId.mockResolvedValue([subscription]);
    (webPush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });

    const result = await service.sendToUser('user-1', { title: 't', body: 'b' });

    expect(result).toBe(true);
    expect(mockSubscriptionRepository.delete).toHaveBeenCalledWith(subscription.id);
  });
});
