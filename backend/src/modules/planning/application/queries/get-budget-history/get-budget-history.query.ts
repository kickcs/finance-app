export class GetBudgetHistoryQuery {
  constructor(
    public readonly userId: string,
    public readonly months: number = 6,
    public readonly startDay: number = 1,
  ) {}
}
