import { AggregateRoot } from '../../../../../shared/domain/base';
import { Money, Currency } from '../../../../../shared/domain/value-objects';
import { DebtType } from '../../value-objects';
import { DebtCreatedEvent, DebtPaymentMadeEvent, DebtClosedEvent } from '../../events';

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
  description: string | null;
  closedAt: Date | null;
  forgivenAmount: number;
  isPrivate: boolean;
  /**
   * Комиссия за перевод, уплаченная при выдаче долга. Сама по себе она уже
   * записана отдельной расходной транзакцией — здесь хранится только для
   * показа полной стоимости долга и в расчётах остатка не участвует.
   */
  feeAmount: number;
  /** Та самая расходная запись. Без неё комиссию нечем править. */
  feeTransactionId: string | null;
}

export interface CreateDebtProps {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  currency: string;
  debtType: 'given' | 'taken';
  personName?: string;
  accountId?: string;
  monthlyPayment?: number;
  nextPaymentDate?: Date;
  createdAt?: Date;
  description?: string;
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
  private _description: string | null;
  private _closedAt: Date | null;
  private _forgivenAmount: number;
  private _isPrivate: boolean;
  private _feeAmount: number;
  private _feeTransactionId: string | null;

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
    this._description = props.description;
    this._closedAt = props.closedAt;
    this._forgivenAmount = props.forgivenAmount;
    this._isPrivate = props.isPrivate;
    this._feeAmount = props.feeAmount;
    this._feeTransactionId = props.feeTransactionId;
  }

  static create(props: CreateDebtProps): Debt {
    const {
      id,
      userId,
      name,
      totalAmount,
      currency,
      debtType,
      personName,
      accountId,
      monthlyPayment,
      nextPaymentDate,
      createdAt,
      description,
    } = props;

    const currencyVo = Currency.create(currency);
    const debt = new Debt({
      id,
      userId,
      name,
      totalAmount: Money.create(totalAmount, currencyVo),
      remainingAmount: Money.create(totalAmount, currencyVo),
      monthlyPayment: monthlyPayment ? Money.create(monthlyPayment, currencyVo) : null,
      nextPaymentDate: nextPaymentDate || null,
      debtType: DebtType.create(debtType),
      personName: personName?.trim() || null,
      accountId: accountId || null,
      transactionId: null,
      closeTransactionId: null,
      isClosed: false,
      sourceTransactionId: null,
      createdAt: createdAt || new Date(),
      description: description?.trim() || null,
      closedAt: null,
      forgivenAmount: 0,
      isPrivate: false,
      feeAmount: 0,
      feeTransactionId: null,
    });

    debt.addDomainEvent(
      new DebtCreatedEvent(id, userId, debtType, totalAmount, currency, accountId || null),
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
  get debtTypeValue(): 'given' | 'taken' {
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
  get description(): string | null {
    return this._description;
  }
  get closedAt(): Date | null {
    return this._closedAt;
  }
  get forgivenAmount(): number {
    return this._forgivenAmount;
  }
  get isPrivate(): boolean {
    return this._isPrivate;
  }
  get feeAmount(): number {
    return this._feeAmount;
  }
  get feeTransactionId(): string | null {
    return this._feeTransactionId;
  }

  // Behaviors
  makePayment(amount: number): void {
    if (this._isClosed) {
      throw new Error('Cannot make payment on a closed debt');
    }
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
      this._closedAt = new Date();
      this._remainingAmount = Money.zero(this.currency);
      this.addDomainEvent(new DebtClosedEvent(this.id, this._userId));
    }
  }

  /**
   * Правка суммы долга двигает остаток на ту же дельту: возвращённое уже
   * возвращено, меняется только то, что осталось вернуть.
   */
  changeTotalAmount(amount: number): void {
    const next = Money.create(amount, this.currency);
    const delta = next.amount - this._totalAmount.amount;
    this._totalAmount = next;
    this._remainingAmount = Money.create(
      Math.max(0, this._remainingAmount.amount + delta),
      this.currency,
    );
  }

  setForgivenAmount(amount: number): void {
    this._forgivenAmount = amount;
  }

  update(data: {
    name?: string;
    totalAmount?: number;
    remainingAmount?: number;
    monthlyPayment?: number | null;
    nextPaymentDate?: Date | null;
    debtType?: 'given' | 'taken';
    personName?: string | null;
    accountId?: string | null;
    transactionId?: string | null;
    closeTransactionId?: string | null;
    isClosed?: boolean;
    sourceTransactionId?: string | null;
    description?: string | null;
    forgivenAmount?: number;
    isPrivate?: boolean;
    createdAt?: Date;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.totalAmount !== undefined)
      this._totalAmount = Money.create(data.totalAmount, this.currency);
    if (data.remainingAmount !== undefined)
      this._remainingAmount = Money.create(data.remainingAmount, this.currency);
    if (data.monthlyPayment !== undefined) {
      this._monthlyPayment =
        data.monthlyPayment !== null ? Money.create(data.monthlyPayment, this.currency) : null;
    }
    if (data.nextPaymentDate !== undefined) this._nextPaymentDate = data.nextPaymentDate;
    if (data.debtType !== undefined) this._debtType = DebtType.create(data.debtType);
    if (data.personName !== undefined) this._personName = data.personName?.trim() || null;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.transactionId !== undefined) this._transactionId = data.transactionId;
    if (data.closeTransactionId !== undefined) this._closeTransactionId = data.closeTransactionId;
    if (data.isClosed === true && !this._isClosed) this.close();
    if (data.isClosed === false) {
      this._isClosed = false;
      this._closedAt = null;
    }
    if (data.sourceTransactionId !== undefined)
      this._sourceTransactionId = data.sourceTransactionId;
    if (data.description !== undefined) this._description = data.description;
    if (data.forgivenAmount !== undefined) this._forgivenAmount = data.forgivenAmount;
    if (data.isPrivate !== undefined) this._isPrivate = data.isPrivate;
    // Дата долга правится: её нередко ставят задним числом, когда долг заводят
    // не в день займа.
    if (data.createdAt !== undefined) this._createdAt = data.createdAt;
  }

  setTransactionId(transactionId: string): void {
    this._transactionId = transactionId;
  }

  setCloseTransactionId(transactionId: string): void {
    this._closeTransactionId = transactionId;
  }

  /**
   * Комиссия и её запись меняются только вместе: сумма без записи — число,
   * которое ничего не списало, запись без суммы — расход из ниоткуда.
   */
  setFee(amount: number, transactionId: string | null): void {
    this._feeAmount = amount;
    this._feeTransactionId = transactionId;
  }
}
