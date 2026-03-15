export class GetBalancesByAccountQuery {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}
