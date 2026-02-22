import { ValueObject } from '../../../../shared/domain/base';

type SubscriptionPlanValue = 'free' | 'premium_monthly' | 'premium_yearly';

interface SubscriptionPlanProps {
  value: SubscriptionPlanValue;
}

export class SubscriptionPlan extends ValueObject<SubscriptionPlanProps> {
  static readonly FREE = new SubscriptionPlan({ value: 'free' });
  static readonly PREMIUM_MONTHLY = new SubscriptionPlan({ value: 'premium_monthly' });
  static readonly PREMIUM_YEARLY = new SubscriptionPlan({ value: 'premium_yearly' });

  private constructor(props: SubscriptionPlanProps) {
    super(props);
  }

  static create(value: string): SubscriptionPlan {
    if (!['free', 'premium_monthly', 'premium_yearly'].includes(value)) {
      throw new Error(`Invalid subscription plan: ${value}`);
    }
    return new SubscriptionPlan({ value: value as SubscriptionPlanValue });
  }

  get value(): SubscriptionPlanValue {
    return this.props.value;
  }

  isFree(): boolean {
    return this.props.value === 'free';
  }

  isPremium(): boolean {
    return this.props.value !== 'free';
  }

  toString(): string {
    return this.props.value;
  }
}
