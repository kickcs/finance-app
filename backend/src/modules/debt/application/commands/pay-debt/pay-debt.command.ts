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
    /** Долг гасится работой, а не деньгами: платёж становится отметкой отработки. */
    public readonly settleWithWork: boolean = false,
    /** Что именно отработано — попадает в описание отметки. */
    public readonly workNote?: string,
    /**
     * Категория работы. С ней отработка пишется парой «трата по категории +
     * возврат долга» (по балансу ноль) и видна в аналитике; без неё остаётся
     * одной информационной отметкой.
     */
    public readonly workCategoryId?: string,
  ) {}
}
