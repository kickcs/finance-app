export class SetCardMappingCommand {
  constructor(
    public readonly userId: string,
    public readonly cardMask: string,
    public readonly accountId: string,
  ) {}
}
