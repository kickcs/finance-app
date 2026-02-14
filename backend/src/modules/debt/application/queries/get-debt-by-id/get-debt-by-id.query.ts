export class GetDebtByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
