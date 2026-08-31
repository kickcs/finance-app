export class PayDebtCommand {
  constructor(
    public readonly userId: string,
    public readonly debtId: string,
    public readonly amount: number,
    public readonly accountId: string,
    public readonly date: Date,
    /** Списать остаток как прощённый и закрыть долг. */
    public readonly forgiveRemainder: boolean = false,
    /** Куда отнести переплату — обязательна, если сумма больше остатка. */
    public readonly excessCategoryId?: string,
  ) {}
}
