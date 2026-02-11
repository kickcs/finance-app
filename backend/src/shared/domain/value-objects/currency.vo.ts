import { ValueObject } from '../base';

interface CurrencyProps {
  code: string;
}

/**
 * Currency Value Object
 * Represents a currency code (ISO 4217)
 */
export class Currency extends ValueObject<CurrencyProps> {
  // Common currencies
  static readonly USD = new Currency({ code: 'USD' });
  static readonly EUR = new Currency({ code: 'EUR' });
  static readonly RUB = new Currency({ code: 'RUB' });
  static readonly UZS = new Currency({ code: 'UZS' });

  private static readonly VALID_CURRENCIES = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CNY',
    'RUB',
    'UZS',
    'KZT',
    'TRY',
    'UAH',
    'AED',
    'CHF',
    'CAD',
    'AUD',
    'NZD',
    'SGD',
    'HKD',
    'KRW',
    'INR',
    'BRL',
  ];

  private constructor(props: CurrencyProps) {
    super(props);
  }

  static create(code: string): Currency {
    const normalizedCode = code.toUpperCase().trim();

    if (!normalizedCode || normalizedCode.length !== 3) {
      throw new Error(`Invalid currency code: ${code}. Must be 3 characters.`);
    }

    if (!this.VALID_CURRENCIES.includes(normalizedCode)) {
      // Allow any 3-letter code for flexibility
      console.warn(`Currency ${normalizedCode} is not in the common list.`);
    }

    return new Currency({ code: normalizedCode });
  }

  get code(): string {
    return this.props.code;
  }

  toString(): string {
    return this.props.code;
  }
}
