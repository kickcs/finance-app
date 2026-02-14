export class DeleteDebtCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
