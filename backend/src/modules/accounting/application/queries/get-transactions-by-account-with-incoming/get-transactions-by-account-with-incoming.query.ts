export class GetTransactionsByAccountWithIncomingQuery {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}
