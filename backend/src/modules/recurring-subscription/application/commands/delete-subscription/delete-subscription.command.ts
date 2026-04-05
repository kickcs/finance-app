export class DeleteSubscriptionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
