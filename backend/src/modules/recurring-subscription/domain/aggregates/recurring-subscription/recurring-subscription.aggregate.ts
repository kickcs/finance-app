import { AggregateRoot } from '../../../../../shared/domain/base';

export type SubscriptionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'paused';

export interface RecurringSubscriptionProps {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  accountId: string | null;
  icon: string;
  color: string;
  frequency: SubscriptionFrequency;
  frequencyDays: number | null;
  billingDate: Date;
  notifyDaysBefore: number[];
  categoryId: string;
  autoCharge: boolean;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class RecurringSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _description: string | null;
  private _amount: number;
  private _currency: string;
  private _accountId: string | null;
  private _icon: string;
  private _color: string;
  private _frequency: SubscriptionFrequency;
  private _frequencyDays: number | null;
  private _billingDate: Date;
  private _notifyDaysBefore: number[];
  private _categoryId: string;
  private _autoCharge: boolean;
  private _status: SubscriptionStatus;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: RecurringSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._description = props.description;
    this._amount = props.amount;
    this._currency = props.currency;
    this._accountId = props.accountId;
    this._icon = props.icon;
    this._color = props.color;
    this._frequency = props.frequency;
    this._frequencyDays = props.frequencyDays;
    this._billingDate = props.billingDate;
    this._notifyDaysBefore = props.notifyDaysBefore;
    this._categoryId = props.categoryId;
    this._autoCharge = props.autoCharge;
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    amount: number,
    currency: string,
    icon: string,
    color: string,
    frequency: SubscriptionFrequency,
    billingDate: Date,
    categoryId: string,
    description?: string | null,
    accountId?: string | null,
    frequencyDays?: number | null,
    notifyDaysBefore: number[] = [2],
    autoCharge: boolean = false,
  ): RecurringSubscription {
    const now = new Date();
    return new RecurringSubscription({
      id,
      userId,
      name,
      description: description ?? null,
      amount,
      currency,
      accountId: accountId ?? null,
      icon,
      color,
      frequency,
      frequencyDays: frequencyDays ?? null,
      billingDate,
      notifyDaysBefore,
      categoryId,
      autoCharge,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: RecurringSubscriptionProps): RecurringSubscription {
    return new RecurringSubscription(props);
  }

  get userId(): string {
    return this._userId;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | null {
    return this._description;
  }
  get amount(): number {
    return this._amount;
  }
  get currency(): string {
    return this._currency;
  }
  get accountId(): string | null {
    return this._accountId;
  }
  get icon(): string {
    return this._icon;
  }
  get color(): string {
    return this._color;
  }
  get frequency(): SubscriptionFrequency {
    return this._frequency;
  }
  get frequencyDays(): number | null {
    return this._frequencyDays;
  }
  get billingDate(): Date {
    return this._billingDate;
  }
  get notifyDaysBefore(): number[] {
    return this._notifyDaysBefore;
  }
  get categoryId(): string {
    return this._categoryId;
  }
  get autoCharge(): boolean {
    return this._autoCharge;
  }
  get status(): SubscriptionStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(data: {
    name?: string;
    description?: string | null;
    amount?: number;
    currency?: string;
    accountId?: string | null;
    icon?: string;
    color?: string;
    frequency?: SubscriptionFrequency;
    frequencyDays?: number | null;
    billingDate?: Date;
    notifyDaysBefore?: number[];
    categoryId?: string;
    autoCharge?: boolean;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.description !== undefined) this._description = data.description;
    if (data.amount !== undefined) this._amount = data.amount;
    if (data.currency !== undefined) this._currency = data.currency;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.frequency !== undefined) this._frequency = data.frequency;
    if (data.frequencyDays !== undefined) this._frequencyDays = data.frequencyDays;
    if (data.billingDate !== undefined) this._billingDate = data.billingDate;
    if (data.notifyDaysBefore !== undefined) this._notifyDaysBefore = data.notifyDaysBefore;
    if (data.categoryId !== undefined) this._categoryId = data.categoryId;
    if (data.autoCharge !== undefined) this._autoCharge = data.autoCharge;
    this._updatedAt = new Date();
  }

  pause(): void {
    this._status = 'paused';
    this._updatedAt = new Date();
  }

  resume(): void {
    this._status = 'active';
    this._updatedAt = new Date();
  }

  advanceBillingDate(): void {
    this._billingDate = RecurringSubscription.advanceDate(
      this._billingDate,
      this._frequency,
      this._frequencyDays,
    );
    this._updatedAt = new Date();
  }

  static advanceDate(
    date: Date,
    frequency: SubscriptionFrequency,
    frequencyDays: number | null,
  ): Date {
    const next = new Date(date);
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'custom':
        next.setDate(next.getDate() + (frequencyDays ?? 30));
        break;
    }
    return next;
  }

  static rewindDate(
    date: Date,
    frequency: SubscriptionFrequency,
    frequencyDays: number | null,
  ): Date {
    const prev = new Date(date);
    switch (frequency) {
      case 'weekly':
        prev.setDate(prev.getDate() - 7);
        break;
      case 'monthly':
        prev.setMonth(prev.getMonth() - 1);
        break;
      case 'quarterly':
        prev.setMonth(prev.getMonth() - 3);
        break;
      case 'yearly':
        prev.setFullYear(prev.getFullYear() - 1);
        break;
      case 'custom':
        prev.setDate(prev.getDate() - (frequencyDays ?? 30));
        break;
    }
    return prev;
  }
}
