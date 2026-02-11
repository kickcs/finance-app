export class GetAnalyticsStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly accountIds?: string[],
  ) {}
}
