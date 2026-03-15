export class DeleteCategoryCommand {
  constructor(
    public readonly userId: string,
    public readonly id: string,
  ) {}
}
