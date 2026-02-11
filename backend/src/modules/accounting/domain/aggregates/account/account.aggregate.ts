import { AggregateRoot } from '../../../../../shared/domain/base';
import { Money } from '../../../../../shared/domain/value-objects';
import { AccountType } from '../../value-objects';
import { AccountBalance } from './account-balance.entity';
import {
  AccountCreatedEvent,
  AccountDeletedEvent,
  BalanceUpdatedEvent,
} from '../../events';

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

  // Behaviors
  update(data: {
    name?: string;
    icon?: string;
    color?: string;
    type?: string;
    order?: number;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.type !== undefined) this._type = AccountType.create(data.type);
    if (data.order !== undefined) this._order = data.order;
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
