import { Entity } from '../../../../../shared/domain/base';
import { Money, Currency } from '../../../../../shared/domain/value-objects';

export interface AccountBalanceProps {
  id: string;
  accountId: string;
  currency: Currency;
  balance: Money;
  createdAt: Date;
}

/**
 * AccountBalance Entity
 * Child entity of Account aggregate
 */
export class AccountBalance extends Entity<string> {
  private _accountId: string;
  private _currency: Currency;
  private _balance: Money;
  private _createdAt: Date;

  private constructor(props: AccountBalanceProps) {
    super(props.id);
    this._accountId = props.accountId;
    this._currency = props.currency;
    this._balance = props.balance;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    accountId: string,
    currency: string,
    balance: number,
  ): AccountBalance {
    const currencyVo = Currency.create(currency);
    return new AccountBalance({
      id,
      accountId,
      currency: currencyVo,
      balance: Money.create(balance, currencyVo),
      createdAt: new Date(),
    });
  }

  static reconstitute(props: AccountBalanceProps): AccountBalance {
    return new AccountBalance(props);
  }

  get accountId(): string {
    return this._accountId;
  }

  get currency(): Currency {
    return this._currency;
  }

  get currencyCode(): string {
    return this._currency.code;
  }

  get balance(): Money {
    return this._balance;
  }

  get balanceAmount(): number {
    return this._balance.amount;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  credit(amount: Money): number {
    if (!amount.currency.equals(this._currency)) {
      throw new Error(
        `Currency mismatch: expected ${this.currencyCode}, got ${amount.currencyCode}`,
      );
    }
    const previousBalance = this._balance.amount;
    this._balance = this._balance.add(amount);
    return previousBalance;
  }

  debit(amount: Money): number {
    if (!amount.currency.equals(this._currency)) {
      throw new Error(
        `Currency mismatch: expected ${this.currencyCode}, got ${amount.currencyCode}`,
      );
    }
    const previousBalance = this._balance.amount;
    this._balance = this._balance.subtract(amount);

    // Warn if balance becomes negative (overdraft scenario)
    if (this._balance.amount < 0 && previousBalance >= 0) {
      console.warn(
        `[AccountBalance] Account ${this._accountId} balance went negative: ` +
          `${previousBalance} ${this.currencyCode} → ${this._balance.amount} ${this.currencyCode}`,
      );
    }

    return previousBalance;
  }

  setBalance(amount: number): void {
    this._balance = Money.create(amount, this._currency);
  }
}
