import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../../../domain/aggregates/push-subscription';
import { IPushSubscriptionRepository } from '../../../domain/repositories';
import { PushSubscriptionOrmEntity } from '../typeorm/push-subscription.orm-entity';
import { PushSubscriptionMapper } from '../mappers/push-subscription.mapper';

@Injectable()
export class PushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionOrmEntity)
    private readonly ormRepository: Repository<PushSubscriptionOrmEntity>,
  ) {}

  async findById(id: string): Promise<PushSubscription | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return PushSubscriptionMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<PushSubscription[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return ormEntities.map((entity) => PushSubscriptionMapper.toDomain(entity));
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { endpoint },
    });
    if (!ormEntity) return null;
    return PushSubscriptionMapper.toDomain(ormEntity);
  }

  async save(subscription: PushSubscription): Promise<PushSubscription> {
    const ormEntity = PushSubscriptionMapper.toOrm(subscription);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return PushSubscriptionMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.ormRepository.delete({ endpoint });
  }
}
