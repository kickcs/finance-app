import { AggregateRoot } from '../../../../shared/domain/base';
import type { Email } from '../value-objects/email.vo';
import { Password } from '../value-objects/password.vo';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { ProfileUpdatedEvent } from '../events/profile-updated.event';

export type WidgetId =
  | 'quick_actions'
  | 'accounts'
  | 'top_expenses'
  | 'transactions'
  | 'debts'
  | 'reminders';

export interface DashboardSettings {
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  hiddenAccountIds: string[];
}

export interface ProfileProps {
  id: string;
  email: Email | null;
  name: string | null;
  password: Password | null;
  currency: string;
  hasCompletedOnboarding: boolean;
  defaultAccountId: string | null;
  isDemo: boolean;
  demoExpiresAt: Date | null;
  refreshToken: string | null;
  dashboardSettings: DashboardSettings | null;
  quickActionsHidden: boolean;
  quickActionsHintDismissed: boolean;
  createdAt: Date;
}

/**
 * Profile Aggregate Root
 * Represents a user profile in the system
 */
export class Profile extends AggregateRoot<string> {
  private _email: Email | null;
  private _name: string | null;
  private _password: Password | null;
  private _currency: string;
  private _hasCompletedOnboarding: boolean;
  private _defaultAccountId: string | null;
  private _isDemo: boolean;
  private _demoExpiresAt: Date | null;
  private _refreshToken: string | null;
  private _dashboardSettings: DashboardSettings | null;
  private _quickActionsHidden: boolean;
  private _quickActionsHintDismissed: boolean;
  private _createdAt: Date;

  private constructor(props: ProfileProps) {
    super(props.id);
    this._email = props.email;
    this._name = props.name;
    this._password = props.password;
    this._currency = props.currency;
    this._hasCompletedOnboarding = props.hasCompletedOnboarding;
    this._defaultAccountId = props.defaultAccountId;
    this._isDemo = props.isDemo;
    this._demoExpiresAt = props.demoExpiresAt;
    this._refreshToken = props.refreshToken;
    this._dashboardSettings = props.dashboardSettings;
    this._quickActionsHidden = props.quickActionsHidden;
    this._quickActionsHintDismissed = props.quickActionsHintDismissed;
    this._createdAt = props.createdAt;
  }

  /**
   * Create a new registered profile
   */
  static createRegistered(
    id: string,
    email: Email,
    name: string | null,
    hashedPassword: string,
    currency: string = 'RUB',
  ): Profile {
    const profile = new Profile({
      id,
      email,
      name,
      password: Password.fromHash(hashedPassword),
      currency,
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: false,
      demoExpiresAt: null,
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      createdAt: new Date(),
    });

    profile.addDomainEvent(new ProfileCreatedEvent(id, email.value, false));

    return profile;
  }

  /**
   * Create an anonymous demo profile
   * Note: hasCompletedOnboarding starts as false and is set to true
   * after demo data is initialized by DemoInitializationService
   */
  static createDemo(id: string, expiresAt: Date): Profile {
    const profile = new Profile({
      id,
      email: null,
      name: 'Demo User',
      password: null,
      currency: 'UZS', // UZS is the default currency for demo accounts
      hasCompletedOnboarding: false,
      defaultAccountId: null,
      isDemo: true,
      demoExpiresAt: expiresAt,
      refreshToken: null,
      dashboardSettings: null,
      quickActionsHidden: false,
      quickActionsHintDismissed: false,
      createdAt: new Date(),
    });

    profile.addDomainEvent(new ProfileCreatedEvent(id, null, true));

    return profile;
  }

  /**
   * Reconstitute profile from persistence
   */
  static reconstitute(props: ProfileProps): Profile {
    return new Profile(props);
  }

  // Getters
  get email(): Email | null {
    return this._email;
  }

  get emailValue(): string | null {
    return this._email?.value ?? null;
  }

  get name(): string | null {
    return this._name;
  }

  get password(): Password | null {
    return this._password;
  }

  get currency(): string {
    return this._currency;
  }

  get hasCompletedOnboarding(): boolean {
    return this._hasCompletedOnboarding;
  }

  get defaultAccountId(): string | null {
    return this._defaultAccountId;
  }

  get isDemo(): boolean {
    return this._isDemo;
  }

  get demoExpiresAt(): Date | null {
    return this._demoExpiresAt;
  }

  get refreshToken(): string | null {
    return this._refreshToken;
  }

  get dashboardSettings(): DashboardSettings | null {
    return this._dashboardSettings;
  }

  get quickActionsHidden(): boolean {
    return this._quickActionsHidden;
  }

  get quickActionsHintDismissed(): boolean {
    return this._quickActionsHintDismissed;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Behaviors
  updateProfile(data: {
    name?: string;
    currency?: string;
    hasCompletedOnboarding?: boolean;
    defaultAccountId?: string | null;
    dashboardSettings?: DashboardSettings | null;
    quickActionsHidden?: boolean;
    quickActionsHintDismissed?: boolean;
  }): void {
    const changes: Record<string, unknown> = {};

    if (data.name !== undefined) {
      this._name = data.name;
      changes.name = data.name;
    }

    if (data.currency !== undefined) {
      this._currency = data.currency;
      changes.currency = data.currency;
    }

    if (data.hasCompletedOnboarding !== undefined) {
      this._hasCompletedOnboarding = data.hasCompletedOnboarding;
      changes.hasCompletedOnboarding = data.hasCompletedOnboarding;
    }

    if (data.defaultAccountId !== undefined) {
      this._defaultAccountId = data.defaultAccountId;
      changes.defaultAccountId = data.defaultAccountId;
    }

    if (data.dashboardSettings !== undefined) {
      this._dashboardSettings = data.dashboardSettings;
      changes.dashboardSettings = data.dashboardSettings;
    }

    if (data.quickActionsHidden !== undefined) {
      this._quickActionsHidden = data.quickActionsHidden;
      changes.quickActionsHidden = data.quickActionsHidden;
    }

    if (data.quickActionsHintDismissed !== undefined) {
      this._quickActionsHintDismissed = data.quickActionsHintDismissed;
      changes.quickActionsHintDismissed = data.quickActionsHintDismissed;
    }

    if (Object.keys(changes).length > 0) {
      this.addDomainEvent(new ProfileUpdatedEvent(this.id, changes));
    }
  }

  setRefreshToken(token: string | null): void {
    this._refreshToken = token;
  }

  isExpired(): boolean {
    if (!this._isDemo || !this._demoExpiresAt) {
      return false;
    }
    return new Date() > this._demoExpiresAt;
  }
}
