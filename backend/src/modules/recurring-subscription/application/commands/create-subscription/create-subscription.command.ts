import { type SubscriptionFrequency } from '../../../domain/aggregates/recurring-subscription';

export class CreateSubscriptionCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly icon: string,
    public readonly color: string,
    public readonly frequency: SubscriptionFrequency,
    public readonly billingDate: Date,
    public readonly categoryId: string,
    public readonly description?: string | null,
    public readonly accountId?: string | null,
    public readonly frequencyDays?: number | null,
    public readonly notifyDaysBefore?: number,
    public readonly autoCharge?: boolean,
  ) {}
}
