import { AggregateRoot } from '../../../../../shared/domain/base';
import { Money, Currency } from '../../../../../shared/domain/value-objects';
import { DebtType } from '../../value-objects';
import {
  DebtCreatedEvent,
  DebtPaymentMadeEvent,
  DebtClosedEvent,
} from '../../events';

export interface DebtProps {
  id: string;
  userId: string;
  name: string;
  totalAmount: Money;
  remainingAmount: Money;
  monthlyPayment: Money | null;
  nextPaymentDate: Date | null;
  debtType: DebtType;
  personName: string | null;
  accountId: string | null;
  transactionId: string | null;
  closeTransactionId: string | null;
  isClosed: boolean;
  sourceTransactionId: string | null;
  createdAt: Date;
}

export class Debt extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _totalAmount: Money;
  private _remainingAmount: Money;
  private _monthlyPayment: Money | null;
  private _nextPaymentDate: Date | null;
  private _debtType: DebtType;
  private _personName: string | null;
  private _accountId: string | null;
  private _transactionId: string | null;
  private _closeTransactionId: string | null;
  private _isClosed: boolean;
  private _sourceTransactionId: string | null;
  private _createdAt: Date;

  private constructor(props: DebtProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._totalAmount = props.totalAmount;
    this._remainingAmount = props.remainingAmount;
    this._monthlyPayment = props.monthlyPayment;
    this._nextPaymentDate = props.nextPaymentDate;
    this._debtType = props.debtType;
    this._personName = props.personName;
    this._accountId = props.accountId;
    this._transactionId = props.transactionId;
    this._closeTransactionId = props.closeTransactionId;
    this._isClosed = props.isClosed;
    this._sourceTransactionId = props.sourceTransactionId;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    totalAmount: number,
    currency: string,
    debtType: string,
    personName?: string,
    accountId?: string,
    monthlyPayment?: number,
    nextPaymentDate?: Date,
  ): Debt {
    const currencyVo = Currency.create(currency);
    const debt = new Debt({
      id,
      userId,
      name,
      totalAmount: Money.create(totalAmount, currencyVo),
      remainingAmount: Money.create(totalAmount, currencyVo),
      monthlyPayment: monthlyPayment
        ? Money.create(monthlyPayment, currencyVo)
        : null,
      nextPaymentDate: nextPaymentDate || null,
      debtType: DebtType.create(debtType),
      personName: personName?.trim() || null,
      accountId: accountId || null,
      transactionId: null,
      closeTransactionId: null,
      isClosed: false,
      sourceTransactionId: null,
      createdAt: new Date(),
    });

    debt.addDomainEvent(
      new DebtCreatedEvent(
        id,
        userId,
        debtType as 'given' | 'taken',
        totalAmount,
        currency,
        accountId || null,
      ),
    );

    return debt;
  }

  static reconstitute(props: DebtProps): Debt {
    return new Debt(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get name(): string {
    return this._name;
  }
  get totalAmount(): Money {
    return this._totalAmount;
  }
  get totalAmountValue(): number {
    return this._totalAmount.amount;
  }
  get remainingAmount(): Money {
    return this._remainingAmount;
  }
  get remainingAmountValue(): number {
    return this._remainingAmount.amount;
  }
  get currency(): string {
    return this._totalAmount.currencyCode;
  }
  get monthlyPayment(): Money | null {
    return this._monthlyPayment;
  }
  get monthlyPaymentValue(): number | null {
    return this._monthlyPayment?.amount ?? null;
  }
  get nextPaymentDate(): Date | null {
    return this._nextPaymentDate;
  }
  get debtType(): DebtType {
    return this._debtType;
  }
  get debtTypeValue(): string {
    return this._debtType.value;
  }
  get personName(): string | null {
    return this._personName;
  }
  get accountId(): string | null {
    return this._accountId;
  }
  get transactionId(): string | null {
    return this._transactionId;
  }
  get closeTransactionId(): string | null {
    return this._closeTransactionId;
  }
  get isClosed(): boolean {
    return this._isClosed;
  }
  get sourceTransactionId(): string | null {
    return this._sourceTransactionId;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  // Behaviors
  makePayment(amount: number): void {
    const payment = Money.create(amount, this.currency);
    this._remainingAmount = this._remainingAmount.subtract(payment);

    this.addDomainEvent(
      new DebtPaymentMadeEvent(
        this.id,
        this._userId,
        amount,
        this.currency,
        this._remainingAmount.amount,
      ),
    );

    if (this._remainingAmount.amount <= 0) {
      this.close();
    }
  }

  close(): void {
    if (!this._isClosed) {
      this._isClosed = true;
      this._remainingAmount = Money.zero(this.currency);
      this.addDomainEvent(new DebtClosedEvent(this.id, this._userId));
    }
  }

  update(data: {
    name?: string;
    totalAmount?: number;
    remainingAmount?: number;
    monthlyPayment?: number | null;
    nextPaymentDate?: Date | null;
    debtType?: string;
    personName?: string | null;
    accountId?: string | null;
    transactionId?: string | null;
    closeTransactionId?: string | null;
    isClosed?: boolean;
    sourceTransactionId?: string | null;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.totalAmount !== undefined)
      this._totalAmount = Money.create(data.totalAmount, this.currency);
    if (data.remainingAmount !== undefined)
      this._remainingAmount = Money.create(data.remainingAmount, this.currency);
    if (data.monthlyPayment !== undefined) {
      this._monthlyPayment =
        data.monthlyPayment !== null
          ? Money.create(data.monthlyPayment, this.currency)
          : null;
    }
    if (data.nextPaymentDate !== undefined)
      this._nextPaymentDate = data.nextPaymentDate;
    if (data.debtType !== undefined)
      this._debtType = DebtType.create(data.debtType);
    if (data.personName !== undefined)
      this._personName = data.personName?.trim() || null;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.transactionId !== undefined)
      this._transactionId = data.transactionId;
    if (data.closeTransactionId !== undefined)
      this._closeTransactionId = data.closeTransactionId;
    if (data.isClosed !== undefined) this._isClosed = data.isClosed;
    if (data.sourceTransactionId !== undefined)
      this._sourceTransactionId = data.sourceTransactionId;
  }

  setTransactionId(transactionId: string): void {
    this._transactionId = transactionId;
  }

  setCloseTransactionId(transactionId: string): void {
    this._closeTransactionId = transactionId;
  }
}
