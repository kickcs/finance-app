import { TransactionMapper } from './transaction.mapper';
import { Transaction } from '../../../domain/aggregates/transaction';
import { TransactionOrmEntity } from '../typeorm/transaction.orm-entity';

describe('TransactionMapper', () => {
  const now = new Date('2026-03-20T12:00:00Z');

  describe('toDomain', () => {
    it('should map expense ORM entity to domain', () => {
      const orm = new TransactionOrmEntity();
      orm.id = 'tx-1';
      orm.userId = 'user-1';
      orm.accountId = 'acc-1';
      orm.categoryId = 'cat-food';
      orm.amount = 50.25;
      orm.currency = 'USD';
      orm.type = 'expense';
      orm.description = 'Lunch';
      orm.date = now;
      orm.isDebtRelated = false;
      orm.debtId = null;
      orm.toAccountId = null;
      orm.toAmount = null;
      orm.toCurrency = null;
      orm.createdAt = now;

      const domain = TransactionMapper.toDomain(orm);

      expect(domain.id).toBe('tx-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.amountValue).toBe(50.25);
      expect(domain.currency).toBe('USD');
      expect(domain.typeValue).toBe('expense');
      expect(domain.description).toBe('Lunch');
      expect(domain.toAccountId).toBeNull();
      expect(domain.toAmount).toBeNull();
    });

    it('should map transfer ORM entity with toAmount/toCurrency', () => {
      const orm = new TransactionOrmEntity();
      orm.id = 'tx-1';
      orm.userId = 'user-1';
      orm.accountId = 'acc-1';
      orm.categoryId = 'transfer';
      orm.amount = 100;
      orm.currency = 'USD';
      orm.type = 'transfer';
      orm.description = null;
      orm.date = now;
      orm.isDebtRelated = false;
      orm.debtId = null;
      orm.toAccountId = 'acc-2';
      orm.toAmount = 92;
      orm.toCurrency = 'EUR';
      orm.createdAt = now;

      const domain = TransactionMapper.toDomain(orm);

      expect(domain.toAccountId).toBe('acc-2');
      expect(domain.toAmountValue).toBe(92);
      expect(domain.toCurrency).toBe('EUR');
    });

    it('should handle string decimal amounts from TypeORM', () => {
      const orm = new TransactionOrmEntity();
      orm.id = 'tx-1';
      orm.userId = 'user-1';
      orm.accountId = 'acc-1';
      orm.categoryId = 'cat-1';
      orm.amount = '1234.56' as unknown as number;
      orm.currency = 'USD';
      orm.type = 'income';
      orm.description = null;
      orm.date = now;
      orm.isDebtRelated = false;
      orm.debtId = null;
      orm.toAccountId = null;
      orm.toAmount = null;
      orm.toCurrency = null;
      orm.createdAt = now;

      const domain = TransactionMapper.toDomain(orm);
      expect(domain.amountValue).toBe(1234.56);
    });
  });

  describe('toOrm', () => {
    it('should map expense domain to ORM', () => {
      const tx = Transaction.createExpense(
        'tx-1',
        'user-1',
        'acc-1',
        'cat-food',
        50.25,
        'USD',
        now,
        'Lunch',
      );

      const orm = TransactionMapper.toOrm(tx);

      expect(orm.id).toBe('tx-1');
      expect(orm.userId).toBe('user-1');
      expect(orm.accountId).toBe('acc-1');
      expect(orm.categoryId).toBe('cat-food');
      expect(orm.amount).toBe(50.25);
      expect(orm.currency).toBe('USD');
      expect(orm.type).toBe('expense');
      expect(orm.description).toBe('Lunch');
      expect(orm.toAccountId).toBeNull();
      expect(orm.toAmount).toBeNull();
      expect(orm.toCurrency).toBeNull();
    });

    it('should map transfer domain to ORM with toAmount', () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'transfer',
        100,
        'USD',
        92,
        'EUR',
        now,
      );

      const orm = TransactionMapper.toOrm(tx);

      expect(orm.toAccountId).toBe('acc-2');
      expect(orm.toAmount).toBe(92);
      expect(orm.toCurrency).toBe('EUR');
    });

    it('should map debt-related fields', () => {
      const tx = Transaction.createIncome(
        'tx-1',
        'user-1',
        'acc-1',
        'cat-1',
        100,
        'USD',
        now,
        'Debt',
        true,
        'debt-1',
      );

      const orm = TransactionMapper.toOrm(tx);

      expect(orm.isDebtRelated).toBe(true);
      expect(orm.debtId).toBe('debt-1');
    });
  });

  describe('round-trip', () => {
    it('should preserve expense data through toDomain -> toOrm', () => {
      const originalOrm = new TransactionOrmEntity();
      originalOrm.id = 'tx-1';
      originalOrm.userId = 'user-1';
      originalOrm.accountId = 'acc-1';
      originalOrm.categoryId = 'cat-food';
      originalOrm.amount = 150.75;
      originalOrm.currency = 'USD';
      originalOrm.type = 'expense';
      originalOrm.description = 'Dinner';
      originalOrm.date = now;
      originalOrm.isDebtRelated = false;
      originalOrm.debtId = null;
      originalOrm.toAccountId = null;
      originalOrm.toAmount = null;
      originalOrm.toCurrency = null;
      originalOrm.createdAt = now;

      const domain = TransactionMapper.toDomain(originalOrm);
      const resultOrm = TransactionMapper.toOrm(domain);

      expect(resultOrm.id).toBe(originalOrm.id);
      expect(resultOrm.amount).toBe(150.75);
      expect(resultOrm.currency).toBe('USD');
      expect(resultOrm.type).toBe('expense');
      expect(resultOrm.description).toBe('Dinner');
    });

    it('should preserve transfer data through round-trip', () => {
      const originalOrm = new TransactionOrmEntity();
      originalOrm.id = 'tx-1';
      originalOrm.userId = 'user-1';
      originalOrm.accountId = 'acc-1';
      originalOrm.categoryId = 'transfer';
      originalOrm.amount = 1000;
      originalOrm.currency = 'USD';
      originalOrm.type = 'transfer';
      originalOrm.description = null;
      originalOrm.date = now;
      originalOrm.isDebtRelated = false;
      originalOrm.debtId = null;
      originalOrm.toAccountId = 'acc-2';
      originalOrm.toAmount = 920;
      originalOrm.toCurrency = 'EUR';
      originalOrm.createdAt = now;

      const domain = TransactionMapper.toDomain(originalOrm);
      const resultOrm = TransactionMapper.toOrm(domain);

      expect(resultOrm.toAccountId).toBe('acc-2');
      expect(resultOrm.toAmount).toBe(920);
      expect(resultOrm.toCurrency).toBe('EUR');
    });
  });
});
