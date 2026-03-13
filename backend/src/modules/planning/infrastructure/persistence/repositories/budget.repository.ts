import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from '../../../domain/aggregates/budget';
import { IBudgetRepository } from '../../../domain/repositories';
import { BudgetOrmEntity } from '../typeorm/budget.orm-entity';
import { BudgetMapper } from '../mappers/budget.mapper';

@Injectable()
export class BudgetRepository implements IBudgetRepository {
  constructor(
    @InjectRepository(BudgetOrmEntity)
    private readonly ormRepository: Repository<BudgetOrmEntity>,
  ) {}

  async findDefault(userId: string): Promise<Budget | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { userId, isDefault: true },
    });
    if (!ormEntity) return null;
    return BudgetMapper.toDomain(ormEntity);
  }

  async findOverride(userId: string, year: number, month: number): Promise<Budget | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { userId, year, month, isDefault: false },
    });
    if (!ormEntity) return null;
    return BudgetMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
    });
    return ormEntities.map((entity) => BudgetMapper.toDomain(entity));
  }

  async save(budget: Budget): Promise<Budget> {
    const ormEntity = BudgetMapper.toOrm(budget);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return BudgetMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }
}
