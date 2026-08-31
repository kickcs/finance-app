export class UpdateDebtCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      name?: string;
      totalAmount?: number;
      monthlyPayment?: number | null;
      nextPaymentDate?: Date | null;
      debtType?: 'given' | 'taken';
      personName?: string | null;
      accountId?: string | null;
      transactionId?: string | null;
      sourceTransactionId?: string | null;
      description?: string | null;
      isPrivate?: boolean;
      createdAt?: Date;
      /** Комиссия за выдачу: меняет и число на долге, и его расходную запись. */
      feeAmount?: number;
    },
  ) {}
}
