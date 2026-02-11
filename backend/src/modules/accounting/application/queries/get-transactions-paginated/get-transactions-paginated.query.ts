export class GetTransactionsPaginatedQuery {
  constructor(
    public readonly userId: string,
    public readonly pageSize: number = 20,
    public readonly cursorDate?: string,
    public readonly cursorCreatedAt?: string,
    public readonly type?: string,
    public readonly accountId?: string,
    public readonly categoryId?: string,
    public readonly search?: string,
  ) {}
}
