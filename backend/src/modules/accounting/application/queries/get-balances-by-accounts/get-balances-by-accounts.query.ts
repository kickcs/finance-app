export class GetBalancesByAccountsQuery {
  constructor(
    public readonly accountIds: string[],
    public readonly userId: string,
  ) {}
}
