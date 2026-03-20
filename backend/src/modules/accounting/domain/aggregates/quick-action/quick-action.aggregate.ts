import { AggregateRoot } from '../../../../../shared/domain/base/aggregate-root.base';

export interface QuickActionProps {
  id: string;
  userId: string;
  categoryId: string;
  accountId: string;
  label: string;
  position: number;
  amount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class QuickAction extends AggregateRoot<string> {
  private _userId: string;
  private _categoryId: string;
  private _accountId: string;
  private _label: string;
  private _position: number;
  private _amount: number | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: QuickActionProps) {
    super(props.id);
    this._userId = props.userId;
    this._categoryId = props.categoryId;
    this._accountId = props.accountId;
    this._label = props.label;
    this._position = props.position;
    this._amount = props.amount;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(
    id: string,
    userId: string,
    categoryId: string,
    accountId: string,
    label: string,
    position: number,
    amount: number | null = null,
  ): QuickAction {
    return new QuickAction({
      id,
      userId,
      categoryId,
      accountId,
      label,
      position,
      amount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: QuickActionProps): QuickAction {
    return new QuickAction(props);
  }

  get userId(): string {
    return this._userId;
  }
  get categoryId(): string {
    return this._categoryId;
  }
  get accountId(): string {
    return this._accountId;
  }
  get label(): string {
    return this._label;
  }
  get position(): number {
    return this._position;
  }
  get amount(): number | null {
    return this._amount;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  update(data: {
    categoryId?: string;
    accountId?: string;
    label?: string;
    amount?: number | null;
  }): void {
    if (data.categoryId !== undefined) this._categoryId = data.categoryId;
    if (data.accountId !== undefined) this._accountId = data.accountId;
    if (data.label !== undefined) this._label = data.label;
    if (data.amount !== undefined) this._amount = data.amount;
    this._updatedAt = new Date();
  }

  setPosition(position: number): void {
    this._position = position;
    this._updatedAt = new Date();
  }
}
