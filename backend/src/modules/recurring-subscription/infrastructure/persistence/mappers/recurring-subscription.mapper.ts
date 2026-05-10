import {
  RecurringSubscription,
  type SubscriptionFrequency,
  type SubscriptionStatus,
} from '../../../domain/aggregates/recurring-subscription';
import { RecurringSubscriptionOrmEntity } from '../typeorm/recurring-subscription.orm-entity';

export class RecurringSubscriptionMapper {
  // TypeORM returns PostgreSQL `date` columns as `YYYY-MM-DD` strings via the
  // pg driver, even though the entity declares the field as `Date`. Normalise
  // to a real UTC-midnight Date so all downstream domain math (which uses
  // getUTC.../setUTC...) is type-safe.
  private static toUtcDate(value: Date | string): Date {
    if (value instanceof Date) return value;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  static toDomain(ormEntity: RecurringSubscriptionOrmEntity): RecurringSubscription {
    return RecurringSubscription.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      description: ormEntity.description,
      amount: Number(ormEntity.amount),
      currency: ormEntity.currency,
      accountId: ormEntity.accountId,
      icon: ormEntity.icon,
      color: ormEntity.color,
      frequency: ormEntity.frequency as SubscriptionFrequency,
      frequencyDays: ormEntity.frequencyDays,
      billingDate: RecurringSubscriptionMapper.toUtcDate(ormEntity.billingDate),
      notifyDaysBefore: ormEntity.notifyDaysBefore,
      categoryId: ormEntity.categoryId,
      autoCharge: ormEntity.autoCharge,
      status: ormEntity.status as SubscriptionStatus,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(subscription: RecurringSubscription): RecurringSubscriptionOrmEntity {
    const ormEntity = new RecurringSubscriptionOrmEntity();
    ormEntity.id = subscription.id;
    ormEntity.userId = subscription.userId;
    ormEntity.name = subscription.name;
    ormEntity.description = subscription.description;
    ormEntity.amount = subscription.amount;
    ormEntity.currency = subscription.currency;
    ormEntity.accountId = subscription.accountId;
    ormEntity.icon = subscription.icon;
    ormEntity.color = subscription.color;
    ormEntity.frequency = subscription.frequency;
    ormEntity.frequencyDays = subscription.frequencyDays;
    ormEntity.billingDate = subscription.billingDate;
    ormEntity.notifyDaysBefore = subscription.notifyDaysBefore;
    ormEntity.categoryId = subscription.categoryId;
    ormEntity.autoCharge = subscription.autoCharge;
    ormEntity.status = subscription.status;
    ormEntity.createdAt = subscription.createdAt;
    ormEntity.updatedAt = subscription.updatedAt;
    return ormEntity;
  }
}
