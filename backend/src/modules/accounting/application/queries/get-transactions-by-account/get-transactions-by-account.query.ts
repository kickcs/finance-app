export class GetTransactionsByAccountQuery {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}
