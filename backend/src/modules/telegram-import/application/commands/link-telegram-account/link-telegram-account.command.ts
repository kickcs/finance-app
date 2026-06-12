export class LinkTelegramAccountCommand {
  constructor(
    public readonly token: string,
    public readonly telegramUserId: string,
    public readonly telegramUsername: string | null,
  ) {}
}
