export class IngestBankMessageCommand {
  constructor(
    public readonly telegramUserId: string,
    public readonly text: string,
  ) {}
}
