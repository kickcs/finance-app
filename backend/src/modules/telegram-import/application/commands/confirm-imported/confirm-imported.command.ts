export class ConfirmImportedCommand {
  constructor(
    public readonly userId: string,
    public readonly importedId: string,
    public readonly transactionId: string,
    public readonly accountId: string,
    public readonly toAccountId: string | undefined, // задан => подтверждено как перевод
  ) {}
}
