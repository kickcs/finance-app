import { AggregateRoot } from '../../../../../shared/domain/base';

export interface PushSubscriptionProps {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
}

export class PushSubscription extends AggregateRoot<string> {
  private _userId: string;
  private _endpoint: string;
  private _p256dh: string;
  private _auth: string;
  private _userAgent: string | null;
  private _createdAt: Date;

  private constructor(props: PushSubscriptionProps) {
    super(props.id);
    this._userId = props.userId;
    this._endpoint = props.endpoint;
    this._p256dh = props.p256dh;
    this._auth = props.auth;
    this._userAgent = props.userAgent;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
    userAgent?: string,
  ): PushSubscription {
    return new PushSubscription({
      id,
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent || null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PushSubscriptionProps): PushSubscription {
    return new PushSubscription(props);
  }

  get userId(): string {
    return this._userId;
  }
  get endpoint(): string {
    return this._endpoint;
  }
  get p256dh(): string {
    return this._p256dh;
  }
  get auth(): string {
    return this._auth;
  }
  get userAgent(): string | null {
    return this._userAgent;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
