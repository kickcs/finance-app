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

  static create(value: string): SubscriptionStatus {
    if (!['active', 'trialing', 'canceled', 'past_due', 'expired'].includes(value)) {
      throw new Error(`Invalid subscription status: ${value}`);
    }
    return new SubscriptionStatus({ value: value as SubscriptionStatusValue });
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
