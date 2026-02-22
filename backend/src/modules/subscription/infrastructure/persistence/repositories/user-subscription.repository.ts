import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSubscription } from '../../../domain/aggregates/user-subscription/user-subscription.aggregate';
import { IUserSubscriptionRepository } from '../../../domain/repositories/user-subscription.repository.interface';
import { UserSubscriptionOrmEntity } from '../typeorm/user-subscription.orm-entity';
import { UserSubscriptionMapper } from '../mappers/user-subscription.mapper';

@Injectable()
export class UserSubscriptionRepository implements IUserSubscriptionRepository {
  constructor(
    @InjectRepository(UserSubscriptionOrmEntity)
    private readonly ormRepository: Repository<UserSubscriptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { id } });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async findByUserId(userId: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({ where: { userId } });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async findByLemonSubscriptionId(lemonSubscriptionId: string): Promise<UserSubscription | null> {
    const orm = await this.ormRepository.findOne({
      where: { lemonSubscriptionId },
    });
    return orm ? UserSubscriptionMapper.toDomain(orm) : null;
  }

  async save(subscription: UserSubscription): Promise<UserSubscription> {
    const orm = UserSubscriptionMapper.toOrm(subscription);
    const saved = await this.ormRepository.save(orm);
    return UserSubscriptionMapper.toDomain(saved);
  }
}
