import { ExchangeRate } from '../../../domain/aggregates';
import { ExchangeRateOrmEntity } from '../typeorm/exchange-rate.orm-entity';

export class ExchangeRateMapper {
  static toDomain(ormEntity: ExchangeRateOrmEntity): ExchangeRate {
    return ExchangeRate.reconstitute({
      baseCurrency: ormEntity.baseCurrency,
      targetCurrency: ormEntity.targetCurrency,
      rate: Number(ormEntity.rate),
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(exchangeRate: ExchangeRate): ExchangeRateOrmEntity {
    const ormEntity = new ExchangeRateOrmEntity();

    ormEntity.baseCurrency = exchangeRate.baseCurrency;
    ormEntity.targetCurrency = exchangeRate.targetCurrency;
    ormEntity.rate = exchangeRate.rate;
    ormEntity.updatedAt = exchangeRate.updatedAt;

    return ormEntity;
  }
}
