import { ValueObject } from '../../../../shared/domain/base';

interface PersonNameProps {
  value: string;
}

export class PersonName extends ValueObject<PersonNameProps> {
  private constructor(props: PersonNameProps) {
    super(props);
  }

  static create(value: string | null): PersonName | null {
    if (!value || value.trim().length === 0) {
      return null;
    }
    return new PersonName({ value: value.trim() });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
