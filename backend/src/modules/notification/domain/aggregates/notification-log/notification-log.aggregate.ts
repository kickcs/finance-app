import { AggregateRoot } from '../../../../../shared/domain/base';
import { NotificationType } from '../../types';

export { NotificationType };

export interface NotificationLogProps {
  id: string;
  userId: string;
  type: NotificationType;
  dedupKey: string;
  payload: Record<string, unknown> | null;
  sentAt: Date;
}

export class NotificationLog extends AggregateRoot<string> {
  private _userId: string;
  private _type: NotificationType;
  private _dedupKey: string;
  private _payload: Record<string, unknown> | null;
  private _sentAt: Date;

  private constructor(props: NotificationLogProps) {
    super(props.id);
    this._userId = props.userId;
    this._type = props.type;
    this._dedupKey = props.dedupKey;
    this._payload = props.payload;
    this._sentAt = props.sentAt;
  }

  static create(
    id: string,
    userId: string,
    type: NotificationType,
    dedupKey: string,
    payload?: Record<string, unknown> | null,
  ): NotificationLog {
    return new NotificationLog({
      id,
      userId,
      type,
      dedupKey,
      payload: payload ?? null,
      sentAt: new Date(),
    });
  }

  static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }

  get userId(): string {
    return this._userId;
  }
  get type(): NotificationType {
    return this._type;
  }
  get dedupKey(): string {
    return this._dedupKey;
  }
  get payload(): Record<string, unknown> | null {
    return this._payload;
  }
  get sentAt(): Date {
    return this._sentAt;
  }
}
