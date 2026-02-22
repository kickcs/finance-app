import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { SubscriptionPlan } from '../../../domain/value-objects/subscription-plan.vo';
import { SubscriptionStatus } from '../../../domain/value-objects/subscription-status.vo';
import { UserSubscriptionOrmEntity } from '../typeorm/user-subscription.orm-entity';

export class UserSubscriptionMapper {
  static toDomain(orm: UserSubscriptionOrmEntity): UserSubscription {
    return UserSubscription.reconstitute({
      id: orm.id,
      userId: orm.userId,
      lemonCustomerId: orm.lemonCustomerId,
      lemonSubscriptionId: orm.lemonSubscriptionId,
      lemonOrderId: orm.variantId,
      plan: SubscriptionPlan.create(orm.plan),
      status: SubscriptionStatus.create(orm.status),
      trialStart: orm.trialStart,
      trialEnd: orm.trialEnd,
      currentPeriodStart: orm.currentPeriodStart,
      currentPeriodEnd: orm.currentPeriodEnd,
      cancelAtPeriodEnd: orm.cancelAtPeriodEnd,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(sub: UserSubscription): UserSubscriptionOrmEntity {
    const orm = new UserSubscriptionOrmEntity();
    orm.id = sub.id;
    orm.userId = sub.userId;
    orm.lemonCustomerId = sub.lemonCustomerId;
    orm.lemonSubscriptionId = sub.lemonSubscriptionId;
    orm.variantId = sub.lemonOrderId;
    orm.plan = sub.planValue;
    orm.status = sub.statusValue;
    orm.trialStart = sub.trialStart;
    orm.trialEnd = sub.trialEnd;
    orm.currentPeriodStart = sub.currentPeriodStart;
    orm.currentPeriodEnd = sub.currentPeriodEnd;
    orm.cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
    orm.createdAt = sub.createdAt;
    orm.updatedAt = sub.updatedAt;
    return orm;
  }
}
