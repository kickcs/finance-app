export class CreateGoalCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly targetAmount: number,
    public readonly icon: string,
    public readonly color: string,
    public readonly deadline?: Date,
    public readonly currentAmount?: number,
  ) {}
}
