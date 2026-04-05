export class GetSubscriptionByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
