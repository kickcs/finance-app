export class CreateManyBalancesCommand {
  constructor(
    public readonly accountId: string,
    public readonly balances: { currency: string; balance: number }[],
  ) {}
}
