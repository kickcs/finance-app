import { ValueObject } from '../../../../shared/domain/base';

type SubscriptionStatusValue = 'active' | 'trialing' | 'canceled' | 'past_due' | 'expired';

interface SubscriptionStatusProps {
  value: SubscriptionStatusValue;
}

export class SubscriptionStatus extends ValueObject<SubscriptionStatusProps> {
  static readonly ACTIVE = new SubscriptionStatus({ value: 'active' });
  static readonly TRIALING = new SubscriptionStatus({ value: 'trialing' });
  static readonly CANCELED = new SubscriptionStatus({ value: 'canceled' });
  static readonly PAST_DUE = new SubscriptionStatus({ value: 'past_due' });
  static readonly EXPIRED = new SubscriptionStatus({ value: 'expired' });

  private constructor(props: SubscriptionStatusProps) {
    super(props);
  }

  private static readonly INSTANCES: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    trialing: SubscriptionStatus.TRIALING,
    canceled: SubscriptionStatus.CANCELED,
    past_due: SubscriptionStatus.PAST_DUE,
    expired: SubscriptionStatus.EXPIRED,
  };

  static create(value: string): SubscriptionStatus {
    const instance = SubscriptionStatus.INSTANCES[value];
    if (!instance) {
      throw new Error(`Invalid subscription status: ${value}`);
    }
    return instance;
  }

  get value(): SubscriptionStatusValue {
    return this.props.value;
  }

  isAccessGranted(): boolean {
    return ['active', 'trialing'].includes(this.props.value);
  }

  toString(): string {
    return this.props.value;
  }
}
