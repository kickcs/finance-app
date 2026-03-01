export class ReorderQuickActionsCommand {
  constructor(
    public readonly userId: string,
    public readonly ids: string[],
  ) {}
}
