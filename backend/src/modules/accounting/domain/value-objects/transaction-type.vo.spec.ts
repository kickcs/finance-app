import { TransactionType } from './transaction-type.vo';

describe('TransactionType Value Object', () => {
  it('should create all valid types', () => {
    const validTypes = ['income', 'expense', 'transfer', 'adjustment'];
    for (const t of validTypes) {
      const type = TransactionType.create(t);
      expect(type.value).toBe(t);
    }
  });

  it('should throw on invalid type', () => {
    expect(() => TransactionType.create('refund')).toThrow('Invalid transaction type: refund');
  });

  it('should correctly identify types via helper methods', () => {
    expect(TransactionType.create('income').isIncome()).toBe(true);
    expect(TransactionType.create('income').isExpense()).toBe(false);
    expect(TransactionType.create('expense').isExpense()).toBe(true);
    expect(TransactionType.create('transfer').isTransfer()).toBe(true);
    expect(TransactionType.create('adjustment').isAdjustment()).toBe(true);
  });

  it('should support equality', () => {
    expect(TransactionType.create('income').equals(TransactionType.create('income'))).toBe(true);
    expect(TransactionType.create('income').equals(TransactionType.create('expense'))).toBe(false);
  });

  it('should have static instances', () => {
    expect(TransactionType.INCOME.value).toBe('income');
    expect(TransactionType.EXPENSE.value).toBe('expense');
    expect(TransactionType.TRANSFER.value).toBe('transfer');
    expect(TransactionType.ADJUSTMENT.value).toBe('adjustment');
  });
});
