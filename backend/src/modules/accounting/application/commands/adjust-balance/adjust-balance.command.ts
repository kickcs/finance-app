export class AdjustBalanceCommand {
  constructor(
    public readonly userId: string,
    public readonly accountId: string,
    public readonly targetBalance: number,
    public readonly currency: string,
    public readonly date: Date,
    public readonly description?: string,
  ) {}
}
