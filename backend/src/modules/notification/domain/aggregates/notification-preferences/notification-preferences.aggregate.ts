import { AggregateRoot } from '../../../../../shared/domain/base';

export interface NotificationPreferencesProps {
  userId: string;
  subscriptionUpcoming: boolean;
  subscriptionCharged: boolean;
  subscriptionFailed: boolean;
  updatedAt: Date;
}

export class NotificationPreferences extends AggregateRoot<string> {
  private _subscriptionUpcoming: boolean;
  private _subscriptionCharged: boolean;
  private _subscriptionFailed: boolean;
  private _updatedAt: Date;

  private constructor(props: NotificationPreferencesProps) {
    super(props.userId);
    this._subscriptionUpcoming = props.subscriptionUpcoming;
    this._subscriptionCharged = props.subscriptionCharged;
    this._subscriptionFailed = props.subscriptionFailed;
    this._updatedAt = props.updatedAt;
  }

  static createDefault(userId: string): NotificationPreferences {
    return new NotificationPreferences({
      userId,
      subscriptionUpcoming: true,
      subscriptionCharged: true,
      subscriptionFailed: true,
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: NotificationPreferencesProps): NotificationPreferences {
    return new NotificationPreferences(props);
  }

  get userId(): string {
    return this.id;
  }
  get subscriptionUpcoming(): boolean {
    return this._subscriptionUpcoming;
  }
  get subscriptionCharged(): boolean {
    return this._subscriptionCharged;
  }
  get subscriptionFailed(): boolean {
    return this._subscriptionFailed;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(prefs: {
    subscriptionUpcoming?: boolean;
    subscriptionCharged?: boolean;
    subscriptionFailed?: boolean;
  }): void {
    if (prefs.subscriptionUpcoming !== undefined) {
      this._subscriptionUpcoming = prefs.subscriptionUpcoming;
    }
    if (prefs.subscriptionCharged !== undefined) {
      this._subscriptionCharged = prefs.subscriptionCharged;
    }
    if (prefs.subscriptionFailed !== undefined) {
      this._subscriptionFailed = prefs.subscriptionFailed;
    }
    this._updatedAt = new Date();
  }
}
