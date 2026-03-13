export class RemoveMonthlyBudgetOverrideCommand {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
  ) {}
}
