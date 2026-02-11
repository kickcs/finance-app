export class GetMonthlyStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly year: number,
    public readonly month: number,
  ) {}
}
