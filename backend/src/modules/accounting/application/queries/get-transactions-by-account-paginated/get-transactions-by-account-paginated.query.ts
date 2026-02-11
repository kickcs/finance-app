export class GetTransactionsByAccountPaginatedQuery {
  constructor(
    public readonly accountId: string,
    public readonly pageSize: number,
    public readonly cursorDate?: string,
    public readonly cursorCreatedAt?: string,
  ) {}
}
