import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExchangeRate } from '../../../domain/aggregates';
import { IExchangeRateRepository } from '../../../domain/repositories/exchange-rate.repository.interface';
import { ExchangeRateOrmEntity } from '../typeorm/exchange-rate.orm-entity';
import { ExchangeRateMapper } from '../mappers/exchange-rate.mapper';

@Injectable()
export class ExchangeRateRepository implements IExchangeRateRepository {
  constructor(
    @InjectRepository(ExchangeRateOrmEntity)
    private readonly ormRepository: Repository<ExchangeRateOrmEntity>,
  ) {}

  async findByPair(baseCurrency: string, targetCurrency: string): Promise<ExchangeRate | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: {
        baseCurrency: baseCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
      },
    });

    if (!ormEntity) {
      return null;
    }

    return ExchangeRateMapper.toDomain(ormEntity);
  }

  async findAll(): Promise<ExchangeRate[]> {
    const ormEntities = await this.ormRepository.find({
      order: { baseCurrency: 'ASC', targetCurrency: 'ASC' },
    });

    return ormEntities.map((entity) => ExchangeRateMapper.toDomain(entity));
  }

  async findByBaseCurrency(baseCurrency: string): Promise<ExchangeRate[]> {
    const ormEntities = await this.ormRepository.find({
      where: { baseCurrency: baseCurrency.toUpperCase() },
      order: { targetCurrency: 'ASC' },
    });

    return ormEntities.map((entity) => ExchangeRateMapper.toDomain(entity));
  }

  async findByTargetCurrency(targetCurrency: string): Promise<ExchangeRate[]> {
    const ormEntities = await this.ormRepository.find({
      where: { targetCurrency: targetCurrency.toUpperCase() },
      order: { baseCurrency: 'ASC' },
    });

    return ormEntities.map((entity) => ExchangeRateMapper.toDomain(entity));
  }

  async save(exchangeRate: ExchangeRate): Promise<ExchangeRate> {
    const ormEntity = ExchangeRateMapper.toOrm(exchangeRate);

    // Use upsert for composite primary key
    await this.ormRepository.upsert(
      {
        baseCurrency: ormEntity.baseCurrency,
        targetCurrency: ormEntity.targetCurrency,
        rate: ormEntity.rate,
        updatedAt: ormEntity.updatedAt,
      },
      ['baseCurrency', 'targetCurrency'],
    );

    // Fetch and return the saved entity
    const savedEntity = await this.findByPair(ormEntity.baseCurrency, ormEntity.targetCurrency);

    return savedEntity!;
  }

  async delete(baseCurrency: string, targetCurrency: string): Promise<void> {
    await this.ormRepository.delete({
      baseCurrency: baseCurrency.toUpperCase(),
      targetCurrency: targetCurrency.toUpperCase(),
    });
  }

  async exists(baseCurrency: string, targetCurrency: string): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: {
        baseCurrency: baseCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
      },
    });

    return count > 0;
  }

  async saveMany(exchangeRates: ExchangeRate[]): Promise<ExchangeRate[]> {
    const ormEntities = exchangeRates.map((rate) => ExchangeRateMapper.toOrm(rate));

    await this.ormRepository.upsert(
      ormEntities.map((e) => ({
        baseCurrency: e.baseCurrency,
        targetCurrency: e.targetCurrency,
        rate: e.rate,
        updatedAt: e.updatedAt,
      })),
      ['baseCurrency', 'targetCurrency'],
    );

    // Fetch all saved entities in a single query instead of N separate queries
    const conditions = ormEntities.map((e) => ({
      baseCurrency: e.baseCurrency,
      targetCurrency: e.targetCurrency,
    }));

    const savedOrmEntities = await this.ormRepository.find({
      where: conditions,
    });

    return savedOrmEntities.map((entity) => ExchangeRateMapper.toDomain(entity));
  }
}
