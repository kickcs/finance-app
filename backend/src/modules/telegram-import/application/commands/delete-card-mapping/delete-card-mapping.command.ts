export class DeleteCardMappingCommand {
  constructor(
    public readonly userId: string,
    public readonly cardMask: string,
  ) {}
}
