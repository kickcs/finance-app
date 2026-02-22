import { ValueObject } from '../../../../shared/domain/base';

interface PasswordProps {
  hashedValue: string;
}

/**
 * Password Value Object
 * Holds hashed password value
 */
export class Password extends ValueObject<PasswordProps> {
  private static readonly MIN_LENGTH = 6;

  private constructor(props: PasswordProps) {
    super(props);
  }

  /**
   * Create from already hashed password (from database)
   */
  static fromHash(hashedValue: string): Password {
    return new Password({ hashedValue });
  }

  /**
   * Validate plain text password meets requirements
   */
  static validatePlainText(plainPassword: string): void {
    if (!plainPassword || plainPassword.length < this.MIN_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }
  }

  get hashedValue(): string {
    return this.props.hashedValue;
  }
}
