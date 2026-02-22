import { AggregateRoot } from '../../../../../shared/domain/base';
import { SubscriptionPlan, SubscriptionStatus } from '../../value-objects';

export interface UserSubscriptionProps {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  lemonCustomerId: string | null;
  lemonSubscriptionId: string | null;
  lemonOrderId: string | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _plan: SubscriptionPlan;
  private _status: SubscriptionStatus;
  private _lemonCustomerId: string | null;
  private _lemonSubscriptionId: string | null;
  private _lemonOrderId: string | null;
  private _trialStart: Date | null;
  private _trialEnd: Date | null;
  private _currentPeriodStart: Date | null;
  private _currentPeriodEnd: Date | null;
  private _cancelAtPeriodEnd: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: UserSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._plan = props.plan;
    this._status = props.status;
    this._lemonCustomerId = props.lemonCustomerId;
    this._lemonSubscriptionId = props.lemonSubscriptionId;
    this._lemonOrderId = props.lemonOrderId;
    this._trialStart = props.trialStart;
    this._trialEnd = props.trialEnd;
    this._currentPeriodStart = props.currentPeriodStart;
    this._currentPeriodEnd = props.currentPeriodEnd;
    this._cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static createFree(id: string, userId: string): UserSubscription {
    return new UserSubscription({
      id,
      userId,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
      lemonCustomerId: null,
      lemonSubscriptionId: null,
      lemonOrderId: null,
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: UserSubscriptionProps): UserSubscription {
    return new UserSubscription(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get plan(): SubscriptionPlan {
    return this._plan;
  }

  get planValue(): string {
    return this._plan.value;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get statusValue(): string {
    return this._status.value;
  }

  get lemonCustomerId(): string | null {
    return this._lemonCustomerId;
  }

  get lemonSubscriptionId(): string | null {
    return this._lemonSubscriptionId;
  }

  get lemonOrderId(): string | null {
    return this._lemonOrderId;
  }

  get trialStart(): Date | null {
    return this._trialStart;
  }

  get trialEnd(): Date | null {
    return this._trialEnd;
  }

  get currentPeriodStart(): Date | null {
    return this._currentPeriodStart;
  }

  get currentPeriodEnd(): Date | null {
    return this._currentPeriodEnd;
  }

  get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Behaviors
  isPremium(): boolean {
    return this._plan.isPremium() && this._status.isAccessGranted();
  }

  activate(data: {
    plan: string;
    lemonCustomerId: string;
    lemonSubscriptionId: string;
    lemonOrderId?: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialStart?: Date;
    trialEnd?: Date;
    status?: string;
  }): void {
    this._plan = SubscriptionPlan.create(data.plan);
    this._status = data.status
      ? SubscriptionStatus.create(data.status)
      : SubscriptionStatus.ACTIVE;
    this._lemonCustomerId = data.lemonCustomerId;
    this._lemonSubscriptionId = data.lemonSubscriptionId;
    this._lemonOrderId = data.lemonOrderId ?? this._lemonOrderId;
    this._currentPeriodStart = data.currentPeriodStart;
    this._currentPeriodEnd = data.currentPeriodEnd;
    this._trialStart = data.trialStart ?? this._trialStart;
    this._trialEnd = data.trialEnd ?? this._trialEnd;
    this._cancelAtPeriodEnd = false;
    this._updatedAt = new Date();
  }

  updateStatus(status: string): void {
    this._status = SubscriptionStatus.create(status);
    this._updatedAt = new Date();
  }

  updatePeriod(start: Date, end: Date): void {
    this._currentPeriodStart = start;
    this._currentPeriodEnd = end;
    this._updatedAt = new Date();
  }

  markCancelAtPeriodEnd(): void {
    this._cancelAtPeriodEnd = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._plan = SubscriptionPlan.FREE;
    this._status = SubscriptionStatus.EXPIRED;
    this._cancelAtPeriodEnd = false;
    this._updatedAt = new Date();
  }
}
