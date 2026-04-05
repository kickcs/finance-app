import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { PUSH_SUBSCRIPTION_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import {
  PUSH_NOTIFICATION_SERVICE,
  PushNotificationService,
} from './application/services/push-notification.service';
import { PushSubscriptionOrmEntity } from './infrastructure/persistence/typeorm';
import { PushSubscriptionRepository } from './infrastructure/persistence/repositories';
import { PushSubscriptionController } from './presentation/controllers';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([PushSubscriptionOrmEntity])],
  controllers: [PushSubscriptionController],
  providers: [
    {
      provide: PUSH_SUBSCRIPTION_REPOSITORY,
      useClass: PushSubscriptionRepository,
    },
    {
      provide: PUSH_NOTIFICATION_SERVICE,
      useClass: PushNotificationService,
    },
    ...CommandHandlers,
  ],
  exports: [PUSH_NOTIFICATION_SERVICE],
})
export class NotificationModule {}
