import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import {
  IPushSubscriptionRepository,
  PUSH_SUBSCRIPTION_REPOSITORY,
} from '../../domain/repositories';

export const PUSH_NOTIFICATION_SERVICE = Symbol('PUSH_NOTIFICATION_SERVICE');

export interface IPushNotificationService {
  sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      icon?: string;
      url?: string;
      tag?: string;
    },
  ): Promise<void>;
}

@Injectable()
export class PushNotificationService implements IPushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IPushSubscriptionRepository,
    private readonly configService: ConfigService,
  ) {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:noreply@example.com',
    );

    if (vapidPublicKey && vapidPrivateKey) {
      webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.vapidConfigured = true;
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications will not be sent.');
      this.vapidConfigured = false;
    }
  }

  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      icon?: string;
      url?: string;
      tag?: string;
    },
  ): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.warn('Push notification skipped: VAPID keys not configured.');
      return;
    }

    const subscriptions = await this.subscriptionRepository.findByUserId(userId);

    if (subscriptions.length === 0) {
      return;
    }

    const notificationPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            notificationPayload,
          );
        } catch (error: unknown) {
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            this.logger.log(
              `Removing expired subscription ${subscription.id} (status ${webPushError.statusCode})`,
            );
            await this.subscriptionRepository.delete(subscription.id);
          } else {
            throw error;
          }
        }
      }),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.warn(
        `Failed to send push notification to ${failures.length}/${subscriptions.length} subscriptions for user ${userId}`,
      );
    }
  }
}
