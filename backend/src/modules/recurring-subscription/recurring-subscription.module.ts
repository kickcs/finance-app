import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { RECURRING_SUBSCRIPTION_REPOSITORY } from './domain/repositories';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { RecurringSubscriptionOrmEntity } from './infrastructure/persistence/typeorm';
import { RecurringSubscriptionRepository } from './infrastructure/persistence/repositories';
import { RecurringSubscriptionsController } from './presentation/controllers';
import { SubscriptionCronService } from './application/services/subscription-cron.service';
import { TimezoneUserResolverService } from './application/services/timezone-user-resolver.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([RecurringSubscriptionOrmEntity]),
    NotificationModule,
  ],
  controllers: [RecurringSubscriptionsController],
  providers: [
    {
      provide: RECURRING_SUBSCRIPTION_REPOSITORY,
      useClass: RecurringSubscriptionRepository,
    },
    SubscriptionCronService,
    TimezoneUserResolverService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [RECURRING_SUBSCRIPTION_REPOSITORY],
})
export class RecurringSubscriptionModule {}
