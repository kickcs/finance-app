export class DeleteBalanceCommand {
  constructor(
    public readonly accountId: string,
    public readonly currency: string,
  ) {}
}
