export class OffsetDebtsCommand {
  constructor(
    public readonly userId: string,
    public readonly personName: string,
    public readonly currency: string,
  ) {}
}
