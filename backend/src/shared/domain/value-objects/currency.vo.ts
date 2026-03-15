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

  private constructor(props: CurrencyProps) {
    super(props);
  }

  static create(code: string): Currency {
    const normalizedCode = code.toUpperCase().trim();

    if (normalizedCode?.length !== 3) {
      throw new Error(`Invalid currency code: ${code}. Must be 3 characters.`);
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
