import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetSubscriptionStatusQuery } from './get-subscription-status.query';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../../../domain/repositories';

export interface SubscriptionStatusResponse {
  plan: string;
  status: string;
  isPremium: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

@QueryHandler(GetSubscriptionStatusQuery)
export class GetSubscriptionStatusHandler
  implements IQueryHandler<GetSubscriptionStatusQuery>
{
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: IUserSubscriptionRepository,
  ) {}

  async execute(
    query: GetSubscriptionStatusQuery,
  ): Promise<SubscriptionStatusResponse> {
    const subscription = await this.subscriptionRepository.findByUserId(
      query.userId,
    );

    if (!subscription) {
      return {
        plan: 'free',
        status: 'active',
        isPremium: false,
        trialEnd: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    return {
      plan: subscription.planValue,
      status: subscription.statusValue,
      isPremium: subscription.isPremium(),
      trialEnd: subscription.trialEnd?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }
}
