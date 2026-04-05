export class GetUpcomingSubscriptionsQuery {
  constructor(
    public readonly userId: string,
    public readonly days: number,
  ) {}
}
