export class UpdateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly data: {
      name?: string;
      icon?: string;
      color?: string;
      type?: string;
      sortOrder?: number;
    },
  ) {}
}
