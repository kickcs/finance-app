import { AggregateRoot } from '../../../../../shared/domain/base';

export interface BudgetProps {
  id: string;
  userId: string;
  year: number | null;
  month: number | null;
  amount: number;
  currency: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Budget extends AggregateRoot<string> {
  private _userId: string;
  private _year: number | null;
  private _month: number | null;
  private _amount: number;
  private _currency: string;
  private _isDefault: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: BudgetProps) {
    super(props.id);
    this._userId = props.userId;
    this._year = props.year;
    this._month = props.month;
    this._amount = props.amount;
    this._currency = props.currency;
    this._isDefault = props.isDefault;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static createDefault(id: string, userId: string, amount: number, currency: string): Budget {
    if (amount <= 0) {
      throw new Error('Budget amount must be greater than 0');
    }

    const now = new Date();
    return new Budget({
      id,
      userId,
      year: null,
      month: null,
      amount,
      currency,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createOverride(
    id: string,
    userId: string,
    year: number,
    month: number,
    amount: number,
    currency: string,
  ): Budget {
    if (month < 1 || month > 12) {
      throw new Error('Month must be between 1 and 12');
    }

    if (amount <= 0) {
      throw new Error('Budget amount must be greater than 0');
    }

    const now = new Date();
    return new Budget({
      id,
      userId,
      year,
      month,
      amount,
      currency,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: BudgetProps): Budget {
    return new Budget(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get year(): number | null {
    return this._year;
  }
  get month(): number | null {
    return this._month;
  }
  get amount(): number {
    return this._amount;
  }
  get currency(): string {
    return this._currency;
  }
  get isDefault(): boolean {
    return this._isDefault;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Behaviors
  updateAmount(amount: number, currency: string): void {
    if (amount <= 0) {
      throw new Error('Budget amount must be greater than 0');
    }

    this._amount = amount;
    this._currency = currency;
    this._updatedAt = new Date();
  }
}
