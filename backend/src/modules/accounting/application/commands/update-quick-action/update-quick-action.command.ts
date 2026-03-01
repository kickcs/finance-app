export class UpdateQuickActionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      categoryId?: string;
      accountId?: string;
      label?: string;
    },
  ) {}
}
