export class CreateDebtCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly totalAmount: number,
    public readonly remainingAmount: number,
    public readonly debtType: 'given' | 'taken',
    public readonly currency: string = 'USD',
    public readonly personName?: string,
    public readonly accountId?: string,
    public readonly monthlyPayment?: number,
    public readonly nextPaymentDate?: Date,
    public readonly transactionId?: string,
    public readonly sourceTransactionId?: string,
  ) {}
}
