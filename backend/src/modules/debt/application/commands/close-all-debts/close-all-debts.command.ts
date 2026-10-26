export class CloseAllDebtsCommand {
  constructor(
    public readonly userId: string,
    public readonly debtIds: string[],
    /** Счёт, на который идут платежи (и переплата). */
    public readonly accountId: string,
    public readonly date: Date,
    /** Сколько внести; без суммы платится весь остаток после зачёта. */
    public readonly paymentAmount?: number,
    /** Недоплаченные долги прощаются и закрываются. */
    public readonly forgiveRemainder: boolean = false,
    /** Куда отнести переплату — обязательна, если сумма больше остатка. */
    public readonly excessCategoryId?: string,
  ) {}
}
