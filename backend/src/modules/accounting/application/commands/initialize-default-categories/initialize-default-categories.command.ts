export class InitializeDefaultCategoriesCommand {
  constructor(
    public readonly userId: string,
    public readonly language?: string,
  ) {}
}
