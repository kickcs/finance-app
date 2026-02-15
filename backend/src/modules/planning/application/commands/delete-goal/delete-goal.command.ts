export class DeleteGoalCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
