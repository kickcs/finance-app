export class UpdateGoalCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly data: {
      name?: string;
      targetAmount?: number;
      currentAmount?: number;
      deadline?: Date | null;
      icon?: string;
      color?: string;
    },
  ) {}
}
