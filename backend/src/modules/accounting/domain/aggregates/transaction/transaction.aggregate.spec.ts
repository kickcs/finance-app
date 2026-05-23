import { Transaction } from './transaction.aggregate';
import { Money } from '../../../../../shared/domain/value-objects';
import { type TransactionDeletedEvent } from '../../events/transaction-deleted.event';
import { TransactionType } from '../../value-objects/transaction-type.vo';

describe('Transaction Aggregate', () => {
  const now = new Date('2026-03-20T12:00:00Z');

  describe('createIncome', () => {
    it('should create an income transaction', () => {
      const tx = Transaction.createIncome(
        'tx-1',
        'user-1',
        'acc-1',
        'cat-salary',
        5000,
        'USD',
        now,
        'Monthly salary',
      );
      expect(tx.id).toBe('tx-1');
      expect(tx.userId).toBe('user-1');
      expect(tx.accountId).toBe('acc-1');
      expect(tx.categoryId).toBe('cat-salary');
      expect(tx.amountValue).toBe(5000);
      expect(tx.currency).toBe('USD');
      expect(tx.typeValue).toBe('income');
      expect(tx.description).toBe('Monthly salary');
      expect(tx.date).toBe(now);
      expect(tx.isDebtRelated).toBe(false);
      expect(tx.debtId).toBeNull();
      expect(tx.toAccountId).toBeNull();
      expect(tx.toAmount).toBeNull();
    });

    it('should create debt-related income', () => {
      const tx = Transaction.createIncome(
        'tx-1',
        'user-1',
        'acc-1',
        'cat-1',
        100,
        'USD',
        now,
        'Debt payment',
        true,
        'debt-1',
      );
      expect(tx.isDebtRelated).toBe(true);
      expect(tx.debtId).toBe('debt-1');
    });

    it('should raise TransactionCreatedEvent', () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      expect(tx.domainEvents).toHaveLength(1);
    });

    it('should set description to null if empty', () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now, '');
      expect(tx.description).toBeNull();
    });
  });

  describe('createExpense', () => {
    it('should create an expense transaction', () => {
      const tx = Transaction.createExpense(
        'tx-1',
        'user-1',
        'acc-1',
        'cat-food',
        50,
        'USD',
        now,
        'Groceries',
      );
      expect(tx.typeValue).toBe('expense');
      expect(tx.amountValue).toBe(50);
      expect(tx.description).toBe('Groceries');
    });

    it('should raise TransactionCreatedEvent', () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 50, 'USD', now);
      expect(tx.domainEvents).toHaveLength(1);
    });
  });

  describe('createTransfer', () => {
    it('should create a transfer transaction with same currency', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-transfer',
        1000,
        'USD',
        1000,
        'USD',
        now,
        'Transfer to savings',
      );
      expect(tx.typeValue).toBe('transfer');
      expect(tx.accountId).toBe('acc-from');
      expect(tx.toAccountId).toBe('acc-to');
      expect(tx.amountValue).toBe(1000);
      expect(tx.currency).toBe('USD');
      expect(tx.toAmountValue).toBe(1000);
      expect(tx.toCurrency).toBe('USD');
    });

    it('should create a cross-currency transfer', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-usd',
        'acc-eur',
        'cat-transfer',
        1000,
        'USD',
        920,
        'EUR',
        now,
      );
      expect(tx.amountValue).toBe(1000);
      expect(tx.currency).toBe('USD');
      expect(tx.toAmountValue).toBe(920);
      expect(tx.toCurrency).toBe('EUR');
    });

    it('should raise TransactionCreatedEvent and TransferCompletedEvent', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-transfer',
        100,
        'USD',
        100,
        'USD',
        now,
      );
      expect(tx.domainEvents).toHaveLength(2);
    });

    it('should set isDebtRelated to false for transfers', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-transfer',
        100,
        'USD',
        100,
        'USD',
        now,
      );
      expect(tx.isDebtRelated).toBe(false);
    });
  });

  describe('createAdjustment', () => {
    it('should create a positive adjustment', () => {
      const tx = Transaction.createAdjustment(
        'tx-1',
        'user-1',
        'acc-1',
        200,
        'USD',
        now,
        false,
        'Found extra cash',
      );
      expect(tx.typeValue).toBe('adjustment');
      expect(tx.categoryId).toBe('balance_adjustment');
      expect(tx.amountValue).toBe(200);
      expect(tx.isDebtRelated).toBe(false);
    });

    it('should create a negative adjustment (isDebtRelated=true for negative)', () => {
      const tx = Transaction.createAdjustment('tx-1', 'user-1', 'acc-1', 100, 'USD', now, true);
      expect(tx.isDebtRelated).toBe(true);
      expect(tx.amountValue).toBe(100);
    });
  });

  describe('update', () => {
    it('should update amount and currency', () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      tx.clearDomainEvents();

      tx.update({ amount: 200, currency: 'EUR' });
      expect(tx.amountValue).toBe(200);
      expect(tx.currency).toBe('EUR');
      expect(tx.domainEvents).toHaveLength(1);
    });

    it('should update description', () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      tx.clearDomainEvents();

      tx.update({ description: 'Updated note' });
      expect(tx.description).toBe('Updated note');
    });

    it('should update toAmount and toCurrency for transfers', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'cat-t',
        100,
        'USD',
        100,
        'USD',
        now,
      );
      tx.clearDomainEvents();

      tx.update({ toAmount: 90, toCurrency: 'EUR' });
      expect(tx.toAmountValue).toBe(90);
      expect(tx.toCurrency).toBe('EUR');
    });

    it('should not raise event if nothing changes', () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      tx.clearDomainEvents();

      tx.update({ accountId: 'acc-1', categoryId: 'cat-1' });
      expect(tx.domainEvents).toHaveLength(0);
    });

    it('should set toAmount to null', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'cat-t',
        100,
        'USD',
        100,
        'USD',
        now,
      );
      tx.clearDomainEvents();

      tx.update({ toAmount: null, toCurrency: null });
      expect(tx.toAmount).toBeNull();
    });
  });

  describe('markDeleted', () => {
    it('should raise TransactionDeletedEvent for expense', () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      tx.clearDomainEvents();

      tx.markDeleted();
      expect(tx.domainEvents).toHaveLength(1);
    });

    it('should include transfer info in deleted event', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'cat-t',
        100,
        'USD',
        90,
        'EUR',
        now,
      );
      tx.clearDomainEvents();

      tx.markDeleted();
      const event = tx.domainEvents[0] as TransactionDeletedEvent;
      expect(event.toAccountId).toBe('acc-2');
      expect(event.toAmount).toBe(90);
      expect(event.toCurrency).toBe('EUR');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props', () => {
      const tx = Transaction.reconstitute({
        id: 'tx-1',
        userId: 'user-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        amount: Money.create(100, 'USD'),
        type: TransactionType.EXPENSE,
        description: 'Test',
        date: now,
        isDebtRelated: false,
        isInformational: false,
        debtId: null,
        toAccountId: null,
        toAmount: null,
        createdAt: now,
      });
      expect(tx.id).toBe('tx-1');
      expect(tx.amountValue).toBe(100);
      expect(tx.domainEvents).toHaveLength(0);
    });
  });
});
