import { DebtCreatedEvent } from './debt-created.event';
import { DebtClosedEvent } from './debt-closed.event';
import { DebtPaymentMadeEvent } from './debt-payment-made.event';

describe('Debt Domain Events', () => {
  describe('DebtCreatedEvent', () => {
    it('should create with correct properties', () => {
      const event = new DebtCreatedEvent('debt-1', 'user-1', 'given', 1000, 'USD', 'acc-1');

      expect(event.debtId).toBe('debt-1');
      expect(event.userId).toBe('user-1');
      expect(event.debtType).toBe('given');
      expect(event.totalAmount).toBe(1000);
      expect(event.currency).toBe('USD');
      expect(event.accountId).toBe('acc-1');
      expect(event.eventName).toBe('debt.created');
      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.eventId).toBeDefined();
    });

    it('should allow null accountId', () => {
      const event = new DebtCreatedEvent('debt-1', 'user-1', 'taken', 500, 'EUR', null);
      expect(event.accountId).toBeNull();
    });
  });

  describe('DebtClosedEvent', () => {
    it('should create with correct properties', () => {
      const event = new DebtClosedEvent('debt-1', 'user-1');

      expect(event.debtId).toBe('debt-1');
      expect(event.userId).toBe('user-1');
      expect(event.eventName).toBe('debt.closed');
      expect(event.occurredOn).toBeInstanceOf(Date);
    });
  });

  describe('DebtPaymentMadeEvent', () => {
    it('should create with correct properties', () => {
      const event = new DebtPaymentMadeEvent('debt-1', 'user-1', 300, 'USD', 700);

      expect(event.debtId).toBe('debt-1');
      expect(event.userId).toBe('user-1');
      expect(event.amount).toBe(300);
      expect(event.currency).toBe('USD');
      expect(event.remainingAmount).toBe(700);
      expect(event.eventName).toBe('debt.payment-made');
      expect(event.occurredOn).toBeInstanceOf(Date);
    });
  });
});
