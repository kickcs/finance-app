import type { PushSubscription } from '../aggregates/push-subscription';

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol('PUSH_SUBSCRIPTION_REPOSITORY');

export interface IPushSubscriptionRepository {
  findById(id: string): Promise<PushSubscription | null>;
  findByUserId(userId: string): Promise<PushSubscription[]>;
  findByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  save(pushSubscription: PushSubscription): Promise<PushSubscription>;
  delete(id: string): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
