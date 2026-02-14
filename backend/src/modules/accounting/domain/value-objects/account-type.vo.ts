import { ValueObject } from '../../../../shared/domain/base';

type AccountTypeValue =
  | 'basic'
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'loan'
  | 'deposit';

interface AccountTypeProps {
  value: AccountTypeValue;
}

/**
 * AccountType Value Object
 */
export class AccountType extends ValueObject<AccountTypeProps> {
  static readonly BASIC = new AccountType({ value: 'basic' });
  static readonly SAVINGS = new AccountType({ value: 'savings' });
  static readonly CREDIT_CARD = new AccountType({ value: 'credit_card' });
  static readonly CASH = new AccountType({ value: 'cash' });
  static readonly LOAN = new AccountType({ value: 'loan' });
  static readonly DEPOSIT = new AccountType({ value: 'deposit' });

  private static readonly VALID_TYPES: AccountTypeValue[] = [
    'basic',
    'savings',
    'credit_card',
    'cash',
    'loan',
    'deposit',
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

  isCreditCard(): boolean {
    return this.props.value === 'credit_card';
  }

  isCash(): boolean {
    return this.props.value === 'cash';
  }

  isLoan(): boolean {
    return this.props.value === 'loan';
  }

  isDeposit(): boolean {
    return this.props.value === 'deposit';
  }

  toString(): string {
    return this.props.value;
  }
}
