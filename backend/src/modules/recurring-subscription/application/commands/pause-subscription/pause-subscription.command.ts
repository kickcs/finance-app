export class PauseSubscriptionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
