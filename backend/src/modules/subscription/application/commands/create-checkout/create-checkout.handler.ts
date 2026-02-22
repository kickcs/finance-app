import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateCheckoutCommand } from './create-checkout.command';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { LemonSqueezyService } from '../../../infrastructure/lemonsqueezy';

@CommandHandler(CreateCheckoutCommand)
export class CreateCheckoutHandler
  implements ICommandHandler<CreateCheckoutCommand>
{
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
    private readonly lemonSqueezyService: LemonSqueezyService,
  ) {}

  async execute(
    command: CreateCheckoutCommand,
  ): Promise<{ checkoutUrl: string }> {
    // Find or create user subscription
    let subscription = await this.subscriptionRepository.findByUserId(
      command.userId,
    );

    if (!subscription) {
      subscription = UserSubscription.createFree(
        crypto.randomUUID(),
        command.userId,
      );
      await this.subscriptionRepository.save(subscription);
    }

    const checkoutUrl = await this.lemonSqueezyService.createCheckoutUrl({
      userId: command.userId,
      userEmail: command.userEmail,
      userName: command.userName,
      plan: command.plan,
    });

    return { checkoutUrl };
  }
}
