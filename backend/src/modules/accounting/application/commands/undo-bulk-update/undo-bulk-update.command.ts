export class UndoBulkUpdateCommand {
  constructor(
    public readonly userId: string,
    public readonly undoToken: string,
  ) {}
}
