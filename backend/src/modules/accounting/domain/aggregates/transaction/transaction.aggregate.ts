import { AggregateRoot } from '../../../../../shared/domain/base';
import { Money } from '../../../../../shared/domain/value-objects';
import { TransactionType } from '../../value-objects';
import {
  TransactionCreatedEvent,
  TransactionUpdatedEvent,
  TransactionDeletedEvent,
  TransferCompletedEvent,
} from '../../events';

export interface TransactionProps {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: Money;
  type: TransactionType;
  description: string | null;
  date: Date;
  isDebtRelated: boolean;
  debtId: string | null;
  toAccountId: string | null;
  toAmount: Money | null;
  createdAt: Date;
}

/**
 * Transaction Aggregate Root
 */
export class Transaction extends AggregateRoot<string> {
  private _userId: string;
  private _accountId: string;
  private _categoryId: string;
  private _amount: Money;
  private _type: TransactionType;
  private _description: string | null;
  private _date: Date;
  private _isDebtRelated: boolean;
  private _debtId: string | null;
  private _toAccountId: string | null;
  private _toAmount: Money | null;
  private _createdAt: Date;

  private constructor(props: TransactionProps) {
    super(props.id);
    this._userId = props.userId;
    this._accountId = props.accountId;
    this._categoryId = props.categoryId;
    this._amount = props.amount;
    this._type = props.type;
    this._description = props.description;
    this._date = props.date;
    this._isDebtRelated = props.isDebtRelated;
    this._debtId = props.debtId;
    this._toAccountId = props.toAccountId;
    this._toAmount = props.toAmount;
    this._createdAt = props.createdAt;
  }

  /**
   * Create an income transaction
   */
  static createIncome(
    id: string,
    userId: string,
    accountId: string,
    categoryId: string,
    amount: number,
    currency: string,
    date: Date,
    description?: string,
    isDebtRelated: boolean = false,
    debtId?: string,
  ): Transaction {
    const transaction = new Transaction({
      id,
      userId,
      accountId,
      categoryId,
      amount: Money.create(amount, currency),
      type: TransactionType.INCOME,
      description: description || null,
      date,
      isDebtRelated,
      debtId: debtId ?? null,
      toAccountId: null,
      toAmount: null,
      createdAt: new Date(),
    });

    transaction.addDomainEvent(
      new TransactionCreatedEvent(id, userId, accountId, amount, currency, 'income', isDebtRelated),
    );

    return transaction;
  }

  /**
   * Create an expense transaction
   */
  static createExpense(
    id: string,
    userId: string,
    accountId: string,
    categoryId: string,
    amount: number,
    currency: string,
    date: Date,
    description?: string,
    isDebtRelated: boolean = false,
    debtId?: string,
  ): Transaction {
    const transaction = new Transaction({
      id,
      userId,
      accountId,
      categoryId,
      amount: Money.create(amount, currency),
      type: TransactionType.EXPENSE,
      description: description || null,
      date,
      isDebtRelated,
      debtId: debtId ?? null,
      toAccountId: null,
      toAmount: null,
      createdAt: new Date(),
    });

    transaction.addDomainEvent(
      new TransactionCreatedEvent(
        id,
        userId,
        accountId,
        amount,
        currency,
        'expense',
        isDebtRelated,
      ),
    );

    return transaction;
  }

  /**
   * Create a transfer transaction
   */
  static createTransfer(
    id: string,
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    categoryId: string,
    fromAmount: number,
    fromCurrency: string,
    toAmount: number,
    toCurrency: string,
    date: Date,
    description?: string,
  ): Transaction {
    const transaction = new Transaction({
      id,
      userId,
      accountId: fromAccountId,
      categoryId,
      amount: Money.create(fromAmount, fromCurrency),
      type: TransactionType.TRANSFER,
      description: description || null,
      date,
      isDebtRelated: false,
      debtId: null,
      toAccountId,
      toAmount: Money.create(toAmount, toCurrency),
      createdAt: new Date(),
    });

    transaction.addDomainEvent(
      new TransactionCreatedEvent(
        id,
        userId,
        fromAccountId,
        fromAmount,
        fromCurrency,
        'transfer',
        false,
        toAccountId,
        toAmount,
        toCurrency,
      ),
    );

    transaction.addDomainEvent(
      new TransferCompletedEvent(
        id,
        userId,
        fromAccountId,
        toAccountId,
        fromAmount,
        toAmount,
        fromCurrency,
        toCurrency,
      ),
    );

    return transaction;
  }

  static createAdjustment(
    id: string,
    userId: string,
    accountId: string,
    amount: number,
    currency: string,
    date: Date,
    isNegative: boolean,
    description?: string,
  ): Transaction {
    const transaction = new Transaction({
      id,
      userId,
      accountId,
      categoryId: 'balance_adjustment',
      amount: Money.create(amount, currency),
      type: TransactionType.ADJUSTMENT,
      description: description || null,
      date,
      isDebtRelated: isNegative,
      debtId: null,
      toAccountId: null,
      toAmount: null,
      createdAt: new Date(),
    });

    transaction.addDomainEvent(
      new TransactionCreatedEvent(id, userId, accountId, amount, currency, 'adjustment', false),
    );

    return transaction;
  }

  static reconstitute(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get accountId(): string {
    return this._accountId;
  }

  get categoryId(): string {
    return this._categoryId;
  }

  get amount(): Money {
    return this._amount;
  }

  get amountValue(): number {
    return this._amount.amount;
  }

  get currency(): string {
    return this._amount.currencyCode;
  }

  get type(): TransactionType {
    return this._type;
  }

  get typeValue(): string {
    return this._type.value;
  }

  get description(): string | null {
    return this._description;
  }

  get date(): Date {
    return this._date;
  }

  get isDebtRelated(): boolean {
    return this._isDebtRelated;
  }

  get debtId(): string | null {
    return this._debtId;
  }

  get toAccountId(): string | null {
    return this._toAccountId;
  }

  get toAmount(): Money | null {
    return this._toAmount;
  }

  get toAmountValue(): number | null {
    return this._toAmount?.amount ?? null;
  }

  get toCurrency(): string | null {
    return this._toAmount?.currencyCode ?? null;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Behaviors
  update(data: {
    accountId?: string;
    categoryId?: string;
    amount?: number;
    currency?: string;
    type?: string;
    description?: string;
    date?: Date;
    isDebtRelated?: boolean;
    debtId?: string | null;
    toAccountId?: string | null;
    toAmount?: number | null;
    toCurrency?: string | null;
  }): void {
    const previousValues: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (data.accountId !== undefined && data.accountId !== this._accountId) {
      previousValues.accountId = this._accountId;
      this._accountId = data.accountId;
      changes.accountId = data.accountId;
    }

    if (data.categoryId !== undefined && data.categoryId !== this._categoryId) {
      previousValues.categoryId = this._categoryId;
      this._categoryId = data.categoryId;
      changes.categoryId = data.categoryId;
    }

    if (data.amount !== undefined || data.currency !== undefined) {
      const newAmount = data.amount ?? this._amount.amount;
      const newCurrency = data.currency ?? this._amount.currencyCode;
      previousValues.amount = this._amount.amount;
      previousValues.currency = this._amount.currencyCode;
      this._amount = Money.create(newAmount, newCurrency);
      changes.amount = newAmount;
      changes.currency = newCurrency;
    }

    if (data.type !== undefined) {
      previousValues.type = this._type.value;
      this._type = TransactionType.create(data.type);
      changes.type = data.type;
    }

    if (data.description !== undefined) {
      previousValues.description = this._description;
      this._description = data.description;
      changes.description = data.description;
    }

    if (data.date !== undefined) {
      previousValues.date = this._date;
      this._date = data.date;
      changes.date = data.date;
    }

    if (data.isDebtRelated !== undefined) {
      previousValues.isDebtRelated = this._isDebtRelated;
      this._isDebtRelated = data.isDebtRelated;
      changes.isDebtRelated = data.isDebtRelated;
    }

    if (data.debtId !== undefined) {
      previousValues.debtId = this._debtId;
      this._debtId = data.debtId;
      changes.debtId = data.debtId;
    }

    if (data.toAccountId !== undefined) {
      previousValues.toAccountId = this._toAccountId;
      this._toAccountId = data.toAccountId;
      changes.toAccountId = data.toAccountId;
    }

    if (data.toAmount !== undefined || data.toCurrency !== undefined) {
      if (data.toAmount !== null && data.toCurrency !== null) {
        previousValues.toAmount = this._toAmount?.amount;
        previousValues.toCurrency = this._toAmount?.currencyCode;
        this._toAmount = Money.create(
          data.toAmount ?? this._toAmount?.amount ?? 0,
          data.toCurrency ?? this._toAmount?.currencyCode ?? 'USD',
        );
        changes.toAmount = this._toAmount.amount;
        changes.toCurrency = this._toAmount.currencyCode;
      } else {
        this._toAmount = null;
        changes.toAmount = null;
        changes.toCurrency = null;
      }
    }

    if (Object.keys(changes).length > 0) {
      this.addDomainEvent(
        new TransactionUpdatedEvent(this.id, this._userId, changes, previousValues),
      );
    }
  }

  markDeleted(): void {
    this.addDomainEvent(
      new TransactionDeletedEvent(
        this.id,
        this._userId,
        this._accountId,
        this._amount.amount,
        this._amount.currencyCode,
        this._type.value as 'income' | 'expense' | 'transfer' | 'adjustment',
        this._isDebtRelated,
        this._toAccountId,
        this._toAmount?.amount ?? null,
        this._toAmount?.currencyCode ?? null,
      ),
    );
  }
}
