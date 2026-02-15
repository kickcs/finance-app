export class GetGoalByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
