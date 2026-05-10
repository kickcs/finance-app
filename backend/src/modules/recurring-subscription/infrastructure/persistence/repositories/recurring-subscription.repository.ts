import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import {
  IRecurringSubscriptionRepository,
  UpcomingSubscriptionRow,
} from '../../../domain/repositories';
import { RecurringSubscriptionOrmEntity } from '../typeorm/recurring-subscription.orm-entity';
import { RecurringSubscriptionMapper } from '../mappers/recurring-subscription.mapper';

@Injectable()
export class RecurringSubscriptionRepository implements IRecurringSubscriptionRepository {
  constructor(
    @InjectRepository(RecurringSubscriptionOrmEntity)
    private readonly ormRepository: Repository<RecurringSubscriptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<RecurringSubscription | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return RecurringSubscriptionMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<RecurringSubscription[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { billingDate: 'ASC' },
    });
    return ormEntities.map((e) => RecurringSubscriptionMapper.toDomain(e));
  }

  async findActiveByUserId(userId: string): Promise<RecurringSubscription[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId, status: 'active' },
      order: { billingDate: 'ASC' },
    });
    return ormEntities.map((e) => RecurringSubscriptionMapper.toDomain(e));
  }

  async findActiveByBillingDate(billingDate: Date): Promise<RecurringSubscription[]> {
    const dateStr = billingDate.toISOString().split('T')[0];
    const ormEntities = await this.ormRepository.find({
      where: { billingDate: dateStr as unknown as Date, status: 'active' },
    });
    return ormEntities.map((e) => RecurringSubscriptionMapper.toDomain(e));
  }

  async findUpcoming(userId: string, days: number): Promise<UpcomingSubscriptionRow[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    // billingDate is the anchor of the next charge, but if auto-charge is off
    // or hasn't run yet, it can be stuck in the past. Roll each subscription
    // forward to its next-due, keep those that fall in the window, and surface
    // the rolled date alongside the aggregate WITHOUT mutating it — calling
    // sub.update() here would bump _updatedAt and leak a fake timestamp into
    // the API response (BUG-14).
    const ormEntities = await this.ormRepository.find({
      where: { userId, status: 'active' },
    });

    const upcoming: UpcomingSubscriptionRow[] = [];
    for (const orm of ormEntities) {
      const sub = RecurringSubscriptionMapper.toDomain(orm);
      const nextDue = RecurringSubscription.nextDueOnOrAfter(
        sub.billingDate,
        today,
        sub.frequency,
        sub.frequencyDays,
      );
      if (nextDue <= endDate) {
        upcoming.push({ subscription: sub, nextDue });
      }
    }

    upcoming.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime());
    return upcoming;
  }

  async save(subscription: RecurringSubscription): Promise<RecurringSubscription> {
    const ormEntity = RecurringSubscriptionMapper.toOrm(subscription);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return RecurringSubscriptionMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }
}
