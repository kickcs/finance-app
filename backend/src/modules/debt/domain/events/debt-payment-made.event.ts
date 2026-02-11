import { DomainEvent } from '../../../../shared/domain/base';

export class DebtPaymentMadeEvent extends DomainEvent {
  constructor(
    public readonly debtId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly remainingAmount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'debt.payment-made';
  }
}
