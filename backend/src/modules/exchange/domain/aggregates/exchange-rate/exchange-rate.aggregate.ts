import { AggregateRoot } from '../../../../../shared/domain/base';
import { CurrencyPair } from '../../value-objects';

export interface ExchangeRateProps {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: Date;
}

/**
 * ExchangeRate Aggregate Root
 * Uses composite key (baseCurrency + targetCurrency) as identifier
 */
export class ExchangeRate extends AggregateRoot<string> {
  private _baseCurrency: string;
  private _targetCurrency: string;
  private _rate: number;
  private _updatedAt: Date;

  private constructor(props: ExchangeRateProps) {
    // Use composite key as ID
    super(`${props.baseCurrency}:${props.targetCurrency}`);
    this._baseCurrency = props.baseCurrency;
    this._targetCurrency = props.targetCurrency;
    this._rate = props.rate;
    this._updatedAt = props.updatedAt;
  }

  static create(
    baseCurrency: string,
    targetCurrency: string,
    rate: number,
  ): ExchangeRate {
    // Validate currency pair
    const currencyPair = CurrencyPair.create(baseCurrency, targetCurrency);

    if (rate <= 0) {
      throw new Error('Exchange rate must be greater than zero');
    }

    return new ExchangeRate({
      baseCurrency: currencyPair.baseCurrency,
      targetCurrency: currencyPair.targetCurrency,
      rate,
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ExchangeRateProps): ExchangeRate {
    return new ExchangeRate(props);
  }

  // Getters
  get baseCurrency(): string {
    return this._baseCurrency;
  }

  get targetCurrency(): string {
    return this._targetCurrency;
  }

  get rate(): number {
    return this._rate;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get currencyPair(): CurrencyPair {
    return CurrencyPair.create(this._baseCurrency, this._targetCurrency);
  }

  // Behaviors
  updateRate(newRate: number): void {
    if (newRate <= 0) {
      throw new Error('Exchange rate must be greater than zero');
    }

    this._rate = newRate;
    this._updatedAt = new Date();
  }

  /**
   * Get the inverse rate for converting from target to base currency
   */
  getInverseRate(): number {
    return 1 / this._rate;
  }

  /**
   * Convert an amount from base currency to target currency
   */
  convert(amount: number): number {
    return amount * this._rate;
  }

  /**
   * Convert an amount from target currency to base currency (reverse conversion)
   */
  convertReverse(amount: number): number {
    return amount / this._rate;
  }
}
