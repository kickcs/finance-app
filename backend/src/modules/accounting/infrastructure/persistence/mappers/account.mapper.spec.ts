import { AccountMapper } from './account.mapper';
import { Account } from '../../../domain/aggregates/account';
import { AccountOrmEntity } from '../typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../typeorm/account-balance.orm-entity';

describe('AccountMapper', () => {
  describe('toDomain', () => {
    it('should map ORM entity to domain aggregate', () => {
      const orm = new AccountOrmEntity();
      orm.id = 'acc-1';
      orm.userId = 'user-1';
      orm.name = 'My Wallet';
      orm.icon = 'wallet';
      orm.color = '#FF0000';
      orm.type = 'basic';
      orm.order = 0;
      orm.createdAt = new Date('2026-01-01');
      orm.creditLimit = null;
      orm.gracePeriodDays = null;
      orm.billingDay = null;
      orm.totalAmount = null;
      orm.interestRate = null;
      orm.monthlyPayment = null;
      orm.startDate = null;
      orm.endDate = null;
      orm.maturityDate = null;
      orm.isReplenishable = null;
      orm.isWithdrawable = null;

      const balanceOrm = new AccountBalanceOrmEntity();
      balanceOrm.id = 'bal-1';
      balanceOrm.accountId = 'acc-1';
      balanceOrm.currency = 'USD';
      balanceOrm.balance = 1000;
      balanceOrm.createdAt = new Date('2026-01-01');
      orm.balances = [balanceOrm];

      const domain = AccountMapper.toDomain(orm);

      expect(domain.id).toBe('acc-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.name).toBe('My Wallet');
      expect(domain.typeValue).toBe('basic');
      expect(domain.balances).toHaveLength(1);
      expect(domain.balances[0].currencyCode).toBe('USD');
      expect(domain.balances[0].balanceAmount).toBe(1000);
    });

    it('should handle account with no balances', () => {
      const orm = new AccountOrmEntity();
      orm.id = 'acc-1';
      orm.userId = 'user-1';
      orm.name = 'Empty';
      orm.icon = 'wallet';
      orm.color = '#000';
      orm.type = 'basic';
      orm.order = 0;
      orm.createdAt = new Date();
      orm.creditLimit = null;
      orm.gracePeriodDays = null;
      orm.billingDay = null;
      orm.totalAmount = null;
      orm.interestRate = null;
      orm.monthlyPayment = null;
      orm.startDate = null;
      orm.endDate = null;
      orm.maturityDate = null;
      orm.isReplenishable = null;
      orm.isWithdrawable = null;
      orm.balances = [];

      const domain = AccountMapper.toDomain(orm);
      expect(domain.balances).toHaveLength(0);
    });

    it('should map credit card fields', () => {
      const orm = new AccountOrmEntity();
      orm.id = 'acc-1';
      orm.userId = 'user-1';
      orm.name = 'Credit';
      orm.icon = 'card';
      orm.color = '#000';
      orm.type = 'credit_card';
      orm.order = 0;
      orm.createdAt = new Date();
      orm.creditLimit = 5000;
      orm.gracePeriodDays = 30;
      orm.billingDay = 15;
      orm.totalAmount = null;
      orm.interestRate = null;
      orm.monthlyPayment = null;
      orm.startDate = null;
      orm.endDate = null;
      orm.maturityDate = null;
      orm.isReplenishable = null;
      orm.isWithdrawable = null;
      orm.balances = [];

      const domain = AccountMapper.toDomain(orm);
      expect(domain.creditLimit).toBe(5000);
      expect(domain.gracePeriodDays).toBe(30);
      expect(domain.billingDay).toBe(15);
    });

    it('should convert string decimal values to numbers', () => {
      const orm = new AccountOrmEntity();
      orm.id = 'acc-1';
      orm.userId = 'user-1';
      orm.name = 'Test';
      orm.icon = 'wallet';
      orm.color = '#000';
      orm.type = 'basic';
      orm.order = 0;
      orm.createdAt = new Date();
      // TypeORM may return decimals as strings
      orm.creditLimit = '5000.00' as unknown as number;
      orm.gracePeriodDays = null;
      orm.billingDay = null;
      orm.totalAmount = '10000.50' as unknown as number;
      orm.interestRate = '12.50' as unknown as number;
      orm.monthlyPayment = '500.00' as unknown as number;
      orm.startDate = null;
      orm.endDate = null;
      orm.maturityDate = null;
      orm.isReplenishable = null;
      orm.isWithdrawable = null;
      orm.balances = [];

      const domain = AccountMapper.toDomain(orm);
      expect(domain.creditLimit).toBe(5000);
      expect(domain.totalAmount).toBe(10000.5);
      expect(domain.interestRate).toBe(12.5);
      expect(domain.monthlyPayment).toBe(500);
    });
  });

  describe('toOrm', () => {
    it('should map domain aggregate to ORM entity', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#FF0000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);

      const orm = AccountMapper.toOrm(account);

      expect(orm.id).toBe('acc-1');
      expect(orm.userId).toBe('user-1');
      expect(orm.name).toBe('Wallet');
      expect(orm.icon).toBe('wallet');
      expect(orm.color).toBe('#FF0000');
      expect(orm.type).toBe('basic');
      expect(orm.order).toBe(0);
      // Primary balance/currency
      expect(orm.balance).toBe(1000);
      expect(orm.currency).toBe('USD');
      expect(orm.balances).toHaveLength(1);
      expect(orm.balances[0].currency).toBe('USD');
      expect(orm.balances[0].balance).toBe(1000);
    });

    it('should handle account with no balances', () => {
      const account = Account.create('acc-1', 'user-1', 'Empty', 'wallet', '#000');

      const orm = AccountMapper.toOrm(account);

      expect(orm.balance).toBe(0);
      expect(orm.currency).toBe('USD'); // default fallback
      expect(orm.balances).toHaveLength(0);
    });

    it('should map type-specific fields', () => {
      const account = Account.create(
        'acc-1',
        'user-1',
        'Credit',
        'card',
        '#000',
        'credit_card',
        0,
        [],
        { creditLimit: 5000, billingDay: 15 },
      );

      const orm = AccountMapper.toOrm(account);

      expect(orm.creditLimit).toBe(5000);
      expect(orm.billingDay).toBe(15);
      expect(orm.gracePeriodDays).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toDomain -> toOrm', () => {
      const originalOrm = new AccountOrmEntity();
      originalOrm.id = 'acc-1';
      originalOrm.userId = 'user-1';
      originalOrm.name = 'Test Account';
      originalOrm.icon = 'wallet';
      originalOrm.color = '#ABCDEF';
      originalOrm.type = 'savings';
      originalOrm.order = 3;
      originalOrm.createdAt = new Date('2026-01-15');
      originalOrm.creditLimit = null;
      originalOrm.gracePeriodDays = null;
      originalOrm.billingDay = null;
      originalOrm.totalAmount = null;
      originalOrm.interestRate = null;
      originalOrm.monthlyPayment = null;
      originalOrm.startDate = null;
      originalOrm.endDate = null;
      originalOrm.maturityDate = null;
      originalOrm.isReplenishable = null;
      originalOrm.isWithdrawable = null;
      originalOrm.balances = [];

      const domain = AccountMapper.toDomain(originalOrm);
      const resultOrm = AccountMapper.toOrm(domain);

      expect(resultOrm.id).toBe(originalOrm.id);
      expect(resultOrm.userId).toBe(originalOrm.userId);
      expect(resultOrm.name).toBe(originalOrm.name);
      expect(resultOrm.type).toBe(originalOrm.type);
      expect(resultOrm.order).toBe(originalOrm.order);
    });
  });
});
