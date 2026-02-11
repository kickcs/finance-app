import { ReminderFrequency } from '../../../domain/aggregates/reminder';

export class CreateReminderCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly amount: number,
    public readonly frequency: ReminderFrequency,
    public readonly nextDate: Date,
    public readonly icon: string,
    public readonly color: string,
  ) {}
}
