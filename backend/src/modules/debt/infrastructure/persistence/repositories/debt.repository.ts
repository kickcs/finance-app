import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Debt } from '../../../domain/aggregates/debt';
import { IDebtRepository } from '../../../domain/repositories';
import { DebtOrmEntity } from '../typeorm/debt.orm-entity';
import { DebtMapper } from '../mappers/debt.mapper';

@Injectable()
export class DebtRepository implements IDebtRepository {
  constructor(
    @InjectRepository(DebtOrmEntity)
    private readonly ormRepository: Repository<DebtOrmEntity>,
  ) {}

  async findById(id: string): Promise<Debt | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return DebtMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Debt[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return ormEntities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByTransactionId(transactionId: string): Promise<Debt | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { transactionId },
    });
    if (!ormEntity) return null;
    return DebtMapper.toDomain(ormEntity);
  }

  async save(debt: Debt): Promise<Debt> {
    const ormEntity = DebtMapper.toOrm(debt);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return DebtMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }
}
