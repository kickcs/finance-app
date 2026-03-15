export class DeleteBalancesByAccountCommand {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
  ) {}
}
