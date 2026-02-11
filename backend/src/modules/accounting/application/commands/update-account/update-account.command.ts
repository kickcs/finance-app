export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly data: {
      name?: string;
      icon?: string;
      color?: string;
      type?: string;
      order?: number;
    },
  ) {}
}
