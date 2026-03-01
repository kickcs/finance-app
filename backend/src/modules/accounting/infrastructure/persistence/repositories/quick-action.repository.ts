import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IQuickActionRepository } from '../../../domain/repositories/quick-action.repository.interface';
import { QuickAction } from '../../../domain/aggregates/quick-action';
import { QuickActionOrmEntity } from '../typeorm/quick-action.orm-entity';
import { QuickActionMapper } from '../mappers/quick-action.mapper';

@Injectable()
export class QuickActionRepository implements IQuickActionRepository {
  constructor(
    @InjectRepository(QuickActionOrmEntity)
    private readonly ormRepository: Repository<QuickActionOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<QuickAction[]> {
    const entities = await this.ormRepository.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((e) => QuickActionMapper.toDomain(e));
  }

  async findById(id: string): Promise<QuickAction | null> {
    const entity = await this.ormRepository.findOne({ where: { id } });
    return entity ? QuickActionMapper.toDomain(entity) : null;
  }

  async save(quickAction: QuickAction): Promise<QuickAction> {
    const orm = QuickActionMapper.toOrm(quickAction);
    const saved = await this.ormRepository.save(orm);
    return QuickActionMapper.toDomain(saved);
  }

  async saveMany(quickActions: QuickAction[]): Promise<QuickAction[]> {
    const orms = quickActions.map((q) => QuickActionMapper.toOrm(q));
    const saved = await this.ormRepository.save(orms);
    return saved.map((e) => QuickActionMapper.toDomain(e));
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.ormRepository.count({ where: { userId } });
  }
}
