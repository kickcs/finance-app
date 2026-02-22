import { ValueObject } from '../../../../shared/domain/base';

type CategoryTypeValue = 'income' | 'expense';

interface CategoryTypeProps {
  value: CategoryTypeValue;
}

/**
 * CategoryType Value Object
 */
export class CategoryType extends ValueObject<CategoryTypeProps> {
  static readonly INCOME = new CategoryType({ value: 'income' });
  static readonly EXPENSE = new CategoryType({ value: 'expense' });

  private static readonly VALID_TYPES: CategoryTypeValue[] = ['income', 'expense'];

  private constructor(props: CategoryTypeProps) {
    super(props);
  }

  static create(value: string): CategoryType {
    if (!this.VALID_TYPES.includes(value as CategoryTypeValue)) {
      throw new Error(
        `Invalid category type: ${value}. Must be one of: ${this.VALID_TYPES.join(', ')}`,
      );
    }
    return new CategoryType({ value: value as CategoryTypeValue });
  }

  get value(): CategoryTypeValue {
    return this.props.value;
  }

  isIncome(): boolean {
    return this.props.value === 'income';
  }

  isExpense(): boolean {
    return this.props.value === 'expense';
  }

  toString(): string {
    return this.props.value;
  }
}
