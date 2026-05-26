import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Domain
import { USER_SUBSCRIPTION_REPOSITORY } from './domain/repositories';

// Application
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';

// Infrastructure
import { UserSubscriptionOrmEntity } from './infrastructure/persistence/typeorm';
import { UserSubscriptionRepository } from './infrastructure/persistence/repositories';
import { LemonSqueezyService, LemonSqueezyWebhookService } from './infrastructure/lemonsqueezy';
import { IapService } from './infrastructure/iap';

// Presentation
import { SubscriptionController } from './presentation/controllers';

// Guards
import { PremiumGuard } from './guards';

@Module({
  imports: [CqrsModule, ConfigModule, TypeOrmModule.forFeature([UserSubscriptionOrmEntity])],
  controllers: [SubscriptionController],
  providers: [
    // Repository
    {
      provide: USER_SUBSCRIPTION_REPOSITORY,
      useClass: UserSubscriptionRepository,
    },

    // Command Handlers
    ...CommandHandlers,

    // Query Handlers
    ...QueryHandlers,

    // Infrastructure Services
    LemonSqueezyService,
    LemonSqueezyWebhookService,
    IapService,

    // Guards
    PremiumGuard,
  ],
  exports: [USER_SUBSCRIPTION_REPOSITORY, PremiumGuard],
})
export class SubscriptionModule {}
