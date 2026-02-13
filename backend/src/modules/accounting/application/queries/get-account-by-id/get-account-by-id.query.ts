export class GetAccountByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
