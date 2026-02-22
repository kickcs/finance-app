import { ValueObject } from '../base';

interface UserIdProps {
  value: string;
}

/**
 * UserId Value Object
 * Represents a unique user identifier (UUID)
 */
export class UserId extends ValueObject<UserIdProps> {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private constructor(props: UserIdProps) {
    super(props);
  }

  static create(value: string): UserId {
    if (!value || !this.UUID_REGEX.test(value)) {
      throw new Error(`Invalid user ID format: ${value}. Must be a valid UUID.`);
    }

    return new UserId({ value: value.toLowerCase() });
  }

  static generate(): UserId {
    return new UserId({ value: crypto.randomUUID() });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
