export class CountTransactionsByAccountQuery {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}
