import { ValueObject } from '../../../../shared/domain/base';

interface EmailProps {
  value: string;
}

/**
 * Email Value Object
 * Validates and holds email addresses
 */
export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    if (!email || !this.EMAIL_REGEX.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    return new Email({ value: email.toLowerCase().trim() });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
