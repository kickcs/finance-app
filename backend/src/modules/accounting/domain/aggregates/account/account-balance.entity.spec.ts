import { AccountBalance } from './account-balance.entity';
import { Money, Currency } from '../../../../../shared/domain/value-objects';

describe('AccountBalance Entity', () => {
  describe('create', () => {
    it('should create a balance with correct properties', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      expect(balance.id).toBe('bal-1');
      expect(balance.accountId).toBe('acc-1');
      expect(balance.currencyCode).toBe('USD');
      expect(balance.balanceAmount).toBe(1000);
      expect(balance.createdAt).toBeInstanceOf(Date);
    });

    it('should create balance with zero amount', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'EUR', 0);
      expect(balance.balanceAmount).toBe(0);
    });

    it('should normalize currency code to uppercase', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'usd', 100);
      expect(balance.currencyCode).toBe('USD');
    });

    it('should create balance with negative amount', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', -500);
      expect(balance.balanceAmount).toBe(-500);
    });
  });

  describe('credit', () => {
    it('should increase balance and return previous amount', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      const previousBalance = balance.credit(Money.create(500, 'USD'));
      expect(previousBalance).toBe(1000);
      expect(balance.balanceAmount).toBe(1500);
    });

    it('should throw on currency mismatch', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      expect(() => balance.credit(Money.create(500, 'EUR'))).toThrow('Currency mismatch');
    });
  });

  describe('debit', () => {
    it('should decrease balance and return previous amount', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      const previousBalance = balance.debit(Money.create(300, 'USD'));
      expect(previousBalance).toBe(1000);
      expect(balance.balanceAmount).toBe(700);
    });

    it('should allow negative balance (debit exceeding balance)', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 100);
      balance.debit(Money.create(200, 'USD'));
      expect(balance.balanceAmount).toBe(-100);
    });

    it('should throw on currency mismatch', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      expect(() => balance.debit(Money.create(500, 'RUB'))).toThrow('Currency mismatch');
    });
  });

  describe('setBalance', () => {
    it('should set balance to exact amount', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      balance.setBalance(2500);
      expect(balance.balanceAmount).toBe(2500);
    });

    it('should allow setting balance to zero', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      balance.setBalance(0);
      expect(balance.balanceAmount).toBe(0);
    });

    it('should allow setting negative balance', () => {
      const balance = AccountBalance.create('bal-1', 'acc-1', 'USD', 1000);
      balance.setBalance(-500);
      expect(balance.balanceAmount).toBe(-500);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props without side effects', () => {
      const now = new Date();
      const balance = AccountBalance.reconstitute({
        id: 'bal-1',
        accountId: 'acc-1',
        currency: Currency.create('USD'),
        balance: Money.create(500, 'USD'),
        createdAt: now,
      });
      expect(balance.id).toBe('bal-1');
      expect(balance.balanceAmount).toBe(500);
    });
  });
});
