import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  NOTIFICATION_LOG_REPOSITORY,
  NOTIFICATION_PREFERENCES_REPOSITORY,
} from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import {
  PUSH_NOTIFICATION_SERVICE,
  PushNotificationService,
} from './application/services/push-notification.service';
import {
  PushSubscriptionOrmEntity,
  NotificationLogOrmEntity,
  NotificationPreferencesOrmEntity,
} from './infrastructure/persistence/typeorm';
import {
  PushSubscriptionRepository,
  NotificationLogRepository,
  NotificationPreferencesRepository,
} from './infrastructure/persistence/repositories';
import { PushSubscriptionController } from './presentation/controllers';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      PushSubscriptionOrmEntity,
      NotificationLogOrmEntity,
      NotificationPreferencesOrmEntity,
    ]),
  ],
  controllers: [PushSubscriptionController],
  providers: [
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: PushSubscriptionRepository,
    },
    {
      provide: NOTIFICATION_LOG_REPOSITORY,
      useClass: NotificationLogRepository,
    },
    {
      provide: NOTIFICATION_PREFERENCES_REPOSITORY,
      useClass: NotificationPreferencesRepository,
    },
    {
      provide: PUSH_NOTIFICATION_SERVICE,
      useClass: PushNotificationService,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    PUSH_NOTIFICATION_SERVICE,
    NOTIFICATION_LOG_REPOSITORY,
    NOTIFICATION_PREFERENCES_REPOSITORY,
  ],
})
export class NotificationModule {}
