import { ValueObject } from '../../../../shared/domain/base';

type TransactionTypeValue = 'income' | 'expense' | 'transfer' | 'adjustment';

interface TransactionTypeProps {
  value: TransactionTypeValue;
}

/**
 * TransactionType Value Object
 */
export class TransactionType extends ValueObject<TransactionTypeProps> {
  static readonly INCOME = new TransactionType({ value: 'income' });
  static readonly EXPENSE = new TransactionType({ value: 'expense' });
  static readonly TRANSFER = new TransactionType({ value: 'transfer' });
  static readonly ADJUSTMENT = new TransactionType({ value: 'adjustment' });

  private static readonly VALID_TYPES: TransactionTypeValue[] = [
    'income',
    'expense',
    'transfer',
    'adjustment',
  ];

  private constructor(props: TransactionTypeProps) {
    super(props);
  }

  static create(value: string): TransactionType {
    if (!this.VALID_TYPES.includes(value as TransactionTypeValue)) {
      throw new Error(
        `Invalid transaction type: ${value}. Must be one of: ${this.VALID_TYPES.join(', ')}`,
      );
    }
    return new TransactionType({ value: value as TransactionTypeValue });
  }

  get value(): TransactionTypeValue {
    return this.props.value;
  }

  isIncome(): boolean {
    return this.props.value === 'income';
  }

  isExpense(): boolean {
    return this.props.value === 'expense';
  }

  isTransfer(): boolean {
    return this.props.value === 'transfer';
  }

  isAdjustment(): boolean {
    return this.props.value === 'adjustment';
  }

  toString(): string {
    return this.props.value;
  }
}
