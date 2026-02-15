export class GetReminderByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
