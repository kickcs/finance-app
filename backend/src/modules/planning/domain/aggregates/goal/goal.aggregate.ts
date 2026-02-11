import { AggregateRoot } from '../../../../../shared/domain/base';

export interface GoalProps {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | null;
  icon: string;
  color: string;
  createdAt: Date;
}

export class Goal extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _targetAmount: number;
  private _currentAmount: number;
  private _deadline: Date | null;
  private _icon: string;
  private _color: string;
  private _createdAt: Date;

  private constructor(props: GoalProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._targetAmount = props.targetAmount;
    this._currentAmount = props.currentAmount;
    this._deadline = props.deadline;
    this._icon = props.icon;
    this._color = props.color;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    targetAmount: number,
    icon: string,
    color: string,
    deadline?: Date,
    currentAmount: number = 0,
  ): Goal {
    return new Goal({
      id,
      userId,
      name,
      targetAmount,
      currentAmount,
      deadline: deadline || null,
      icon,
      color,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: GoalProps): Goal {
    return new Goal(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get name(): string {
    return this._name;
  }
  get targetAmount(): number {
    return this._targetAmount;
  }
  get currentAmount(): number {
    return this._currentAmount;
  }
  get deadline(): Date | null {
    return this._deadline;
  }
  get icon(): string {
    return this._icon;
  }
  get color(): string {
    return this._color;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  // Computed
  get progress(): number {
    if (this._targetAmount === 0) return 0;
    return Math.min((this._currentAmount / this._targetAmount) * 100, 100);
  }

  get isCompleted(): boolean {
    return this._currentAmount >= this._targetAmount;
  }

  // Behaviors
  update(data: {
    name?: string;
    targetAmount?: number;
    currentAmount?: number;
    deadline?: Date | null;
    icon?: string;
    color?: string;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.targetAmount !== undefined) this._targetAmount = data.targetAmount;
    if (data.currentAmount !== undefined)
      this._currentAmount = data.currentAmount;
    if (data.deadline !== undefined) this._deadline = data.deadline;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
  }

  addAmount(amount: number): void {
    this._currentAmount += amount;
  }

  withdrawAmount(amount: number): void {
    this._currentAmount = Math.max(0, this._currentAmount - amount);
  }
}
