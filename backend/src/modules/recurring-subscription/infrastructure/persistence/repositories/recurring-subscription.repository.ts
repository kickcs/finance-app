import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { RecurringSubscription } from '../../../domain/aggregates/recurring-subscription';
import { IRecurringSubscriptionRepository } from '../../../domain/repositories';
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

  async findUpcoming(userId: string, days: number): Promise<RecurringSubscription[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const ormEntities = await this.ormRepository.find({
      where: {
        userId,
        status: 'active',
        billingDate: Between(todayStr, endStr) as unknown as Date,
      },
      order: { billingDate: 'ASC' },
    });
    return ormEntities.map((e) => RecurringSubscriptionMapper.toDomain(e));
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
