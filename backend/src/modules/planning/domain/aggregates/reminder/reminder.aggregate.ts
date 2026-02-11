import { AggregateRoot } from '../../../../../shared/domain/base';

export type ReminderFrequency = 'weekly' | 'monthly' | 'yearly' | 'once';

export interface ReminderProps {
  id: string;
  userId: string;
  name: string;
  amount: number;
  frequency: ReminderFrequency;
  nextDate: Date;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
}

export class Reminder extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _amount: number;
  private _frequency: ReminderFrequency;
  private _nextDate: Date;
  private _icon: string;
  private _color: string;
  private _isActive: boolean;
  private _createdAt: Date;

  private constructor(props: ReminderProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._amount = props.amount;
    this._frequency = props.frequency;
    this._nextDate = props.nextDate;
    this._icon = props.icon;
    this._color = props.color;
    this._isActive = props.isActive;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    amount: number,
    frequency: ReminderFrequency,
    nextDate: Date,
    icon: string,
    color: string,
  ): Reminder {
    return new Reminder({
      id,
      userId,
      name,
      amount,
      frequency,
      nextDate,
      icon,
      color,
      isActive: true,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ReminderProps): Reminder {
    return new Reminder(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get name(): string {
    return this._name;
  }
  get amount(): number {
    return this._amount;
  }
  get frequency(): ReminderFrequency {
    return this._frequency;
  }
  get nextDate(): Date {
    return this._nextDate;
  }
  get icon(): string {
    return this._icon;
  }
  get color(): string {
    return this._color;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  // Computed
  get isDue(): boolean {
    return new Date() >= this._nextDate;
  }

  // Behaviors
  update(data: {
    name?: string;
    amount?: number;
    frequency?: ReminderFrequency;
    nextDate?: Date;
    icon?: string;
    color?: string;
    isActive?: boolean;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.amount !== undefined) this._amount = data.amount;
    if (data.frequency !== undefined) this._frequency = data.frequency;
    if (data.nextDate !== undefined) this._nextDate = data.nextDate;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.isActive !== undefined) this._isActive = data.isActive;
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    this._isActive = false;
  }

  advanceNextDate(): void {
    if (this._frequency === 'once') {
      this._isActive = false;
      return;
    }

    const current = new Date(this._nextDate);
    switch (this._frequency) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
    this._nextDate = current;
  }
}
