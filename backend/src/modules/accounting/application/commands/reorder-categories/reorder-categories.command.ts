export class ReorderCategoriesCommand {
  constructor(
    public readonly userId: string,
    public readonly categoryIds: string[],
  ) {}
}
