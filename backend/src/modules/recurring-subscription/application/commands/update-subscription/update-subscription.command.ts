import { type SubscriptionFrequency } from '../../../domain/aggregates/recurring-subscription';

export class UpdateSubscriptionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
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
      notifyDaysBefore?: number;
      categoryId?: string;
      autoCharge?: boolean;
    },
  ) {}
}
