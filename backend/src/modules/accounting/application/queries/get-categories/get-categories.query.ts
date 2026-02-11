export class GetCategoriesQuery {
  constructor(
    public readonly userId: string,
    public readonly type?: 'income' | 'expense',
  ) {}
}
