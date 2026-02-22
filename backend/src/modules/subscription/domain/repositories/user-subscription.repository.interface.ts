import type { UserSubscription } from '../aggregates/user-subscription/user-subscription.aggregate';

export const USER_SUBSCRIPTION_REPOSITORY = Symbol('USER_SUBSCRIPTION_REPOSITORY');

export interface IUserSubscriptionRepository {
  findById(id: string): Promise<UserSubscription | null>;
  findByUserId(userId: string): Promise<UserSubscription | null>;
  findByLemonSubscriptionId(lemonSubscriptionId: string): Promise<UserSubscription | null>;
  save(subscription: UserSubscription): Promise<UserSubscription>;
}
