import { ValueObject } from '../base';
import { Currency } from './currency.vo';

interface MoneyProps {
  amount: number;
  currency: Currency;
}

/**
 * Money Value Object
 * Represents a monetary amount with currency
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: Currency | string): Money {
    if (!Number.isFinite(amount)) {
      throw new Error('Amount must be a finite number');
    }

    const currencyVo = typeof currency === 'string' ? Currency.create(currency) : currency;

    // Round to 2 decimal places
    const roundedAmount = Math.round(amount * 100) / 100;

    return new Money({
      amount: roundedAmount,
      currency: currencyVo,
    });
  }

  static zero(currency: Currency | string): Money {
    return Money.create(0, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  get currencyCode(): string {
    return this.props.currency.code;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(this.amount * factor, this.currency);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return Money.create(this.amount / divisor, this.currency);
  }

  negate(): Money {
    return Money.create(-this.amount, this.currency);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount <= other.amount;
  }

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new Error(
        `Cannot operate on money with different currencies: ${this.currencyCode} vs ${other.currencyCode}`,
      );
    }
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currencyCode}`;
  }
}
