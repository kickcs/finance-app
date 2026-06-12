export class DismissImportedCommand {
  constructor(
    public readonly userId: string,
    public readonly importedId: string,
  ) {}
}
