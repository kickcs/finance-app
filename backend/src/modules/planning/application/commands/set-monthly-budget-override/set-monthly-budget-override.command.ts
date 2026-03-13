export class SetMonthlyBudgetOverrideCommand {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}
