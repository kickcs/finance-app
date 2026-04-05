import { PushSubscription } from '../../../domain/aggregates/push-subscription';
import { PushSubscriptionOrmEntity } from '../typeorm/push-subscription.orm-entity';

export class PushSubscriptionMapper {
  static toDomain(ormEntity: PushSubscriptionOrmEntity): PushSubscription {
    return PushSubscription.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      endpoint: ormEntity.endpoint,
      p256dh: ormEntity.p256dh,
      auth: ormEntity.auth,
      userAgent: ormEntity.userAgent,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(subscription: PushSubscription): PushSubscriptionOrmEntity {
    const ormEntity = new PushSubscriptionOrmEntity();
    ormEntity.id = subscription.id;
    ormEntity.userId = subscription.userId;
    ormEntity.endpoint = subscription.endpoint;
    ormEntity.p256dh = subscription.p256dh;
    ormEntity.auth = subscription.auth;
    ormEntity.userAgent = subscription.userAgent;
    ormEntity.createdAt = subscription.createdAt;
    return ormEntity;
  }
}
