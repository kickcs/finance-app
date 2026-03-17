export class UpdateDebtCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      name?: string;
      totalAmount?: number;
      remainingAmount?: number;
      monthlyPayment?: number | null;
      nextPaymentDate?: Date | null;
      debtType?: string;
      personName?: string | null;
      accountId?: string | null;
      transactionId?: string | null;
      closeTransactionId?: string | null;
      isClosed?: boolean;
      sourceTransactionId?: string | null;
      description?: string | null;
      forgivenAmount?: number;
    },
  ) {}
}
