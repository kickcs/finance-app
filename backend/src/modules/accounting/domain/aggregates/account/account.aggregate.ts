import { AggregateRoot } from '../../../../../shared/domain/base';
import { Money } from '../../../../../shared/domain/value-objects';
import { AccountType } from '../../value-objects';
import { AccountBalance } from './account-balance.entity';
import {
  AccountCreatedEvent,
  AccountDeletedEvent,
  BalanceUpdatedEvent,
} from '../../events';

export interface AccountTypeFields {
  creditLimit?: number | null;
  gracePeriodDays?: number | null;
  billingDay?: number | null;
  totalAmount?: number | null;
  interestRate?: number | null;
  monthlyPayment?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  maturityDate?: Date | null;
  isReplenishable?: boolean | null;
  isWithdrawable?: boolean | null;
}

export interface AccountProps {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: AccountType;
  order: number;
  balances: AccountBalance[];
  createdAt: Date;
  // Type-specific fields
  creditLimit: number | null;
  gracePeriodDays: number | null;
  billingDay: number | null;
  totalAmount: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  startDate: Date | null;
  endDate: Date | null;
  maturityDate: Date | null;
  isReplenishable: boolean | null;
  isWithdrawable: boolean | null;
}

/**
 * Account Aggregate Root
 * Manages account with multiple currency balances
 */
export class Account extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _icon: string;
  private _color: string;
  private _type: AccountType;
  private _order: number;
  private _balances: AccountBalance[];
  private _createdAt: Date;
  // Type-specific fields
  private _creditLimit: number | null;
  private _gracePeriodDays: number | null;
  private _billingDay: number | null;
  private _totalAmount: number | null;
  private _interestRate: number | null;
  private _monthlyPayment: number | null;
  private _startDate: Date | null;
  private _endDate: Date | null;
  private _maturityDate: Date | null;
  private _isReplenishable: boolean | null;
  private _isWithdrawable: boolean | null;

  private constructor(props: AccountProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._icon = props.icon;
    this._color = props.color;
    this._type = props.type;
    this._order = props.order;
    this._balances = props.balances;
    this._createdAt = props.createdAt;
    this._creditLimit = props.creditLimit;
    this._gracePeriodDays = props.gracePeriodDays;
    this._billingDay = props.billingDay;
    this._totalAmount = props.totalAmount;
    this._interestRate = props.interestRate;
    this._monthlyPayment = props.monthlyPayment;
    this._startDate = props.startDate;
    this._endDate = props.endDate;
    this._maturityDate = props.maturityDate;
    this._isReplenishable = props.isReplenishable;
    this._isWithdrawable = props.isWithdrawable;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    icon: string,
    color: string,
    type: string = 'basic',
    order: number = 0,
    initialBalances: Array<{ currency: string; balance: number }> = [],
    typeFields?: AccountTypeFields,
  ): Account {
    const balances = initialBalances.map((b) =>
      AccountBalance.create(crypto.randomUUID(), id, b.currency, b.balance),
    );

    const account = new Account({
      id,
      userId,
      name,
      icon,
      color,
      type: AccountType.create(type),
      order,
      balances,
      createdAt: new Date(),
      creditLimit: typeFields?.creditLimit ?? null,
      gracePeriodDays: typeFields?.gracePeriodDays ?? null,
      billingDay: typeFields?.billingDay ?? null,
      totalAmount: typeFields?.totalAmount ?? null,
      interestRate: typeFields?.interestRate ?? null,
      monthlyPayment: typeFields?.monthlyPayment ?? null,
      startDate: typeFields?.startDate ?? null,
      endDate: typeFields?.endDate ?? null,
      maturityDate: typeFields?.maturityDate ?? null,
      isReplenishable: typeFields?.isReplenishable ?? null,
      isWithdrawable: typeFields?.isWithdrawable ?? null,
    });

    account.addDomainEvent(new AccountCreatedEvent(id, userId, name, type));

    return account;
  }

  static reconstitute(props: AccountProps): Account {
    return new Account(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get name(): string {
    return this._name;
  }

  get icon(): string {
    return this._icon;
  }

  get color(): string {
    return this._color;
  }

  get type(): AccountType {
    return this._type;
  }

  get typeValue(): string {
    return this._type.value;
  }

  get order(): number {
    return this._order;
  }

  get balances(): AccountBalance[] {
    return [...this._balances];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get creditLimit(): number | null {
    return this._creditLimit;
  }

  get gracePeriodDays(): number | null {
    return this._gracePeriodDays;
  }

  get billingDay(): number | null {
    return this._billingDay;
  }

  get totalAmount(): number | null {
    return this._totalAmount;
  }

  get interestRate(): number | null {
    return this._interestRate;
  }

  get monthlyPayment(): number | null {
    return this._monthlyPayment;
  }

  get startDate(): Date | null {
    return this._startDate;
  }

  get endDate(): Date | null {
    return this._endDate;
  }

  get maturityDate(): Date | null {
    return this._maturityDate;
  }

  get isReplenishable(): boolean | null {
    return this._isReplenishable;
  }

  get isWithdrawable(): boolean | null {
    return this._isWithdrawable;
  }

  // Behaviors
  update(data: {
    name?: string;
    icon?: string;
    color?: string;
    type?: string;
    order?: number;
    creditLimit?: number | null;
    gracePeriodDays?: number | null;
    billingDay?: number | null;
    totalAmount?: number | null;
    interestRate?: number | null;
    monthlyPayment?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    maturityDate?: Date | null;
    isReplenishable?: boolean | null;
    isWithdrawable?: boolean | null;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.type !== undefined) this._type = AccountType.create(data.type);
    if (data.order !== undefined) this._order = data.order;
    if (data.creditLimit !== undefined) this._creditLimit = data.creditLimit;
    if (data.gracePeriodDays !== undefined)
      this._gracePeriodDays = data.gracePeriodDays;
    if (data.billingDay !== undefined) this._billingDay = data.billingDay;
    if (data.totalAmount !== undefined) this._totalAmount = data.totalAmount;
    if (data.interestRate !== undefined) this._interestRate = data.interestRate;
    if (data.monthlyPayment !== undefined)
      this._monthlyPayment = data.monthlyPayment;
    if (data.startDate !== undefined) this._startDate = data.startDate;
    if (data.endDate !== undefined) this._endDate = data.endDate;
    if (data.maturityDate !== undefined) this._maturityDate = data.maturityDate;
    if (data.isReplenishable !== undefined)
      this._isReplenishable = data.isReplenishable;
    if (data.isWithdrawable !== undefined)
      this._isWithdrawable = data.isWithdrawable;
  }

  setOrder(order: number): void {
    this._order = order;
  }

  getBalance(currency: string): AccountBalance | undefined {
    return this._balances.find(
      (b) => b.currencyCode === currency.toUpperCase(),
    );
  }

  getOrCreateBalance(
    currency: string,
    initialBalance: number = 0,
  ): AccountBalance {
    let balance = this.getBalance(currency);
    if (!balance) {
      balance = AccountBalance.create(
        crypto.randomUUID(),
        this.id,
        currency,
        initialBalance,
      );
      this._balances.push(balance);
    }
    return balance;
  }

  credit(amount: number, currency: string): void {
    const balance = this.getOrCreateBalance(currency);
    const previousBalance = balance.credit(Money.create(amount, currency));

    this.addDomainEvent(
      new BalanceUpdatedEvent(
        this.id,
        this._userId,
        currency,
        previousBalance,
        balance.balanceAmount,
        amount,
      ),
    );
  }

  debit(amount: number, currency: string): void {
    const balance = this.getOrCreateBalance(currency);
    const previousBalance = balance.debit(Money.create(amount, currency));

    this.addDomainEvent(
      new BalanceUpdatedEvent(
        this.id,
        this._userId,
        currency,
        previousBalance,
        balance.balanceAmount,
        -amount,
      ),
    );
  }

  markDeleted(): void {
    this.addDomainEvent(new AccountDeletedEvent(this.id, this._userId));
  }

  getTotalBalance(currency: string): number {
    const balance = this.getBalance(currency);
    return balance?.balanceAmount ?? 0;
  }
}
