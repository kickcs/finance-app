export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      name?: string;
      icon?: string;
      color?: string;
      type?: string;
      order?: number;
      creditLimit?: number | null;
      gracePeriodDays?: number | null;
      billingDay?: number | null;
      totalAmount?: number | null;
      interestRate?: number | null;
      monthlyPayment?: number | null;
      startDate?: Date | null;
      endDate?: Date | null;
      maturityDate?: Date | null;
      isReplenishable?: boolean | null;
      isWithdrawable?: boolean | null;
    },
  ) {}
}
