export class UnregisterPushSubscriptionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
