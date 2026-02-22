import { ValueObject } from '../../../../shared/domain/base';

interface CurrencyPairProps {
  baseCurrency: string;
  targetCurrency: string;
}

/**
 * CurrencyPair Value Object
 * Represents a pair of currencies for exchange rate operations
 */
export class CurrencyPair extends ValueObject<CurrencyPairProps> {
  private constructor(props: CurrencyPairProps) {
    super(props);
  }

  static create(baseCurrency: string, targetCurrency: string): CurrencyPair {
    if (!baseCurrency || !targetCurrency) {
      throw new Error('Currency codes cannot be null or empty');
    }

    const base = baseCurrency.toUpperCase().trim();
    const target = targetCurrency.toUpperCase().trim();

    if (base.length !== 3) {
      throw new Error(`Invalid base currency code: ${baseCurrency}`);
    }

    if (target.length !== 3) {
      throw new Error(`Invalid target currency code: ${targetCurrency}`);
    }

    if (base === target) {
      throw new Error('Base and target currencies must be different');
    }

    return new CurrencyPair({ baseCurrency: base, targetCurrency: target });
  }

  get baseCurrency(): string {
    return this.props.baseCurrency;
  }

  get targetCurrency(): string {
    return this.props.targetCurrency;
  }

  /**
   * Returns the composite key string for this currency pair
   */
  toKey(): string {
    return `${this.props.baseCurrency}:${this.props.targetCurrency}`;
  }

  /**
   * Returns the inverse currency pair
   */
  inverse(): CurrencyPair {
    return CurrencyPair.create(this.props.targetCurrency, this.props.baseCurrency);
  }

  toString(): string {
    return `${this.props.baseCurrency}/${this.props.targetCurrency}`;
  }
}
