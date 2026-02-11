import { ValueObject } from '../../../../shared/domain/base';

type AccountTypeValue = 'basic' | 'savings';

interface AccountTypeProps {
  value: AccountTypeValue;
}

/**
 * AccountType Value Object
 */
export class AccountType extends ValueObject<AccountTypeProps> {
  static readonly BASIC = new AccountType({ value: 'basic' });
  static readonly SAVINGS = new AccountType({ value: 'savings' });

  private static readonly VALID_TYPES: AccountTypeValue[] = [
    'basic',
    'savings',
  ];

  private constructor(props: AccountTypeProps) {
    super(props);
  }

  static create(value: string): AccountType {
    if (!this.VALID_TYPES.includes(value as AccountTypeValue)) {
      throw new Error(
        `Invalid account type: ${value}. Must be one of: ${this.VALID_TYPES.join(', ')}`,
      );
    }
    return new AccountType({ value: value as AccountTypeValue });
  }

  get value(): AccountTypeValue {
    return this.props.value;
  }

  isBasic(): boolean {
    return this.props.value === 'basic';
  }

  isSavings(): boolean {
    return this.props.value === 'savings';
  }

  toString(): string {
    return this.props.value;
  }
}
