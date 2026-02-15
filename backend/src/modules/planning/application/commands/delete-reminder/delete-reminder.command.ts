export class DeleteReminderCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
