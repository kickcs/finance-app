export class UpdateBalanceByDeltaCommand {
  constructor(
    public readonly accountId: string,
    public readonly currency: string,
    public readonly delta: number,
    public readonly userId: string,
  ) {}
}
