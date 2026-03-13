export class SetDefaultBudgetCommand {
  constructor(
    public readonly userId: string,
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}
