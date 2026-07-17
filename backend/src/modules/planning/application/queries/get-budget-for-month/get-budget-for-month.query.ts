export class GetBudgetForMonthQuery {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
    public readonly startDay: number = 1,
    public readonly timezone: string = 'UTC',
  ) {}
}
