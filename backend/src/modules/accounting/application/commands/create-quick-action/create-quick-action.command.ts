export class CreateQuickActionCommand {
  constructor(
    public readonly userId: string,
    public readonly categoryId: string,
    public readonly accountId: string,
    public readonly label: string,
    public readonly amount?: number,
  ) {}
}
