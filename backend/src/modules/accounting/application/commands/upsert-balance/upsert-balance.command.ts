export class UpsertBalanceCommand {
  constructor(
    public readonly accountId: string,
    public readonly currency: string,
    public readonly balance: number,
  ) {}
}
