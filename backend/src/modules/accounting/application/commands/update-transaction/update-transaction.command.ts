export class UpdateTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      accountId?: string;
      categoryId?: string;
      amount?: number;
      currency?: string;
      type?: string;
      description?: string;
      date?: Date;
      isDebtRelated?: boolean;
      debtId?: string | null;
      toAccountId?: string | null;
      toAmount?: number | null;
      toCurrency?: string | null;
    },
  ) {}
}
