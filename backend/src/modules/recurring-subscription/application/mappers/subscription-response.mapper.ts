import type { RecurringSubscription } from '../../domain/aggregates/recurring-subscription';

export class SubscriptionResponseMapper {
  static toResponse(subscription: RecurringSubscription) {
    return {
      id: subscription.id,
      userId: subscription.userId,
      name: subscription.name,
      description: subscription.description,
      amount: subscription.amount,
      currency: subscription.currency,
      accountId: subscription.accountId,
      icon: subscription.icon,
      color: subscription.color,
      frequency: subscription.frequency,
      frequencyDays: subscription.frequencyDays,
      billingDate: subscription.billingDate,
      notifyDaysBefore: subscription.notifyDaysBefore,
      categoryId: subscription.categoryId,
      autoCharge: subscription.autoCharge,
      status: subscription.status,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  static toResponseList(subscriptions: RecurringSubscription[]) {
    return subscriptions.map((s) => SubscriptionResponseMapper.toResponse(s));
  }
}
