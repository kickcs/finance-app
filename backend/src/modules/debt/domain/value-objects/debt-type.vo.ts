import { ValueObject } from '../../../../shared/domain/base';

type DebtTypeValue = 'given' | 'taken';

interface DebtTypeProps {
  value: DebtTypeValue;
}

export class DebtType extends ValueObject<DebtTypeProps> {
  static readonly GIVEN = new DebtType({ value: 'given' });
  static readonly TAKEN = new DebtType({ value: 'taken' });

  private constructor(props: DebtTypeProps) {
    super(props);
  }

  static create(value: string): DebtType {
    if (value !== 'given' && value !== 'taken') {
      throw new Error(`Invalid debt type: ${value}`);
    }
    return new DebtType({ value });
  }

  get value(): DebtTypeValue {
    return this.props.value;
  }

  isGiven(): boolean {
    return this.props.value === 'given';
  }

  isTaken(): boolean {
    return this.props.value === 'taken';
  }

  toString(): string {
    return this.props.value;
  }
}
