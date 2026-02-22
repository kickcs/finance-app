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

  private static readonly INSTANCES: Record<string, SubscriptionPlan> = {
    free: SubscriptionPlan.FREE,
    premium_monthly: SubscriptionPlan.PREMIUM_MONTHLY,
    premium_yearly: SubscriptionPlan.PREMIUM_YEARLY,
  };

  static create(value: string): SubscriptionPlan {
    const instance = SubscriptionPlan.INSTANCES[value];
    if (!instance) {
      throw new Error(`Invalid subscription plan: ${value}`);
    }
    return instance;
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
