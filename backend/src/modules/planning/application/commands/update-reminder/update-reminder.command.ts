import { ReminderFrequency } from '../../../domain/aggregates/reminder';

export class UpdateReminderCommand {
  constructor(
    public readonly id: string,
    public readonly data: {
      name?: string;
      amount?: number;
      frequency?: ReminderFrequency;
      nextDate?: Date;
      icon?: string;
      color?: string;
      isActive?: boolean;
    },
  ) {}
}
