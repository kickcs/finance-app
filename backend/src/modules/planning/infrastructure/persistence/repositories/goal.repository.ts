import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../../../domain/aggregates/goal';
import { IGoalRepository } from '../../../domain/repositories';
import { GoalOrmEntity } from '../typeorm/goal.orm-entity';
import { GoalMapper } from '../mappers/goal.mapper';

@Injectable()
export class GoalRepository implements IGoalRepository {
  constructor(
    @InjectRepository(GoalOrmEntity)
    private readonly ormRepository: Repository<GoalOrmEntity>,
  ) {}

  async findById(id: string): Promise<Goal | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return GoalMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Goal[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return ormEntities.map((entity) => GoalMapper.toDomain(entity));
  }

  async save(goal: Goal): Promise<Goal> {
    const ormEntity = GoalMapper.toOrm(goal);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return GoalMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }
}
