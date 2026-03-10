import { AggregateRoot } from '../../../../../shared/domain/base';
import { CategoryType } from '../../value-objects';

export interface CategoryProps {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  sortOrder: number;
  isFrequent: boolean;
  createdAt: Date;
}

/**
 * Category Aggregate Root
 */
export class Category extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _icon: string;
  private _color: string;
  private _type: CategoryType;
  private _sortOrder: number;
  private _isFrequent: boolean;
  private _createdAt: Date;

  private constructor(props: CategoryProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._icon = props.icon;
    this._color = props.color;
    this._type = props.type;
    this._sortOrder = props.sortOrder;
    this._isFrequent = props.isFrequent;
    this._createdAt = props.createdAt;
  }

  static create(
    id: string,
    userId: string,
    name: string,
    icon: string,
    color: string,
    type: string,
    sortOrder: number = 0,
    isFrequent: boolean = true,
  ): Category {
    return new Category({
      id,
      userId,
      name,
      icon,
      color,
      type: CategoryType.create(type),
      sortOrder,
      isFrequent,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get name(): string {
    return this._name;
  }

  get icon(): string {
    return this._icon;
  }

  get color(): string {
    return this._color;
  }

  get type(): CategoryType {
    return this._type;
  }

  get typeValue(): string {
    return this._type.value;
  }

  get sortOrder(): number {
    return this._sortOrder;
  }

  get isFrequent(): boolean {
    return this._isFrequent;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Behaviors
  update(data: {
    name?: string;
    icon?: string;
    color?: string;
    type?: string;
    sortOrder?: number;
    isFrequent?: boolean;
  }): void {
    if (data.name !== undefined) this._name = data.name;
    if (data.icon !== undefined) this._icon = data.icon;
    if (data.color !== undefined) this._color = data.color;
    if (data.type !== undefined) this._type = CategoryType.create(data.type);
    if (data.sortOrder !== undefined) this._sortOrder = data.sortOrder;
    if (data.isFrequent !== undefined) this._isFrequent = data.isFrequent;
  }
}
