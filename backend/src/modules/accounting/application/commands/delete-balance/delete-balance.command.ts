export class DeleteBalanceCommand {
  constructor(
    public readonly accountId: string,
    public readonly currency: string,
    public readonly userId: string,
  ) {}
}
