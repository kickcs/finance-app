export class ReorderAccountsCommand {
  constructor(
    public readonly accountIds: string[],
    public readonly userId: string,
  ) {}
}
