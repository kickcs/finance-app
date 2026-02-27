import { AggregateRoot } from '../../../../../shared/domain/base';

export interface PersonProps {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Person extends AggregateRoot<string> {
  private _userId: string;
  private _name: string;
  private _color: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: PersonProps) {
    super(props.id);
    this._userId = props.userId;
    this._name = props.name;
    this._color = props.color;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(id: string, userId: string, name: string, color: string): Person {
    const now = new Date();
    return new Person({
      id,
      userId,
      name: name.trim(),
      color,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: PersonProps): Person {
    return new Person(props);
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get name(): string {
    return this._name;
  }
  get color(): string {
    return this._color;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Behaviors
  update(data: { name?: string; color?: string }): void {
    if (data.name !== undefined) this._name = data.name.trim();
    if (data.color !== undefined) this._color = data.color;
    this._updatedAt = new Date();
  }
}
