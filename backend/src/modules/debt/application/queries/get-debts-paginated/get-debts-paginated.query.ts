export class GetDebtsPaginatedQuery {
  constructor(
    public readonly userId: string,
    public readonly pageSize: number = 10,
    public readonly cursorPersonName?: string,
    public readonly cursorDebtType?: string,
    public readonly cursorCreatedAt?: string,
    public readonly status?: string,
    public readonly currency?: string,
    public readonly personName?: string,
  ) {}
}
