import { Account } from './account.aggregate';

describe('Account Aggregate', () => {
  describe('create', () => {
    it('should create an account with basic properties', () => {
      const account = Account.create('acc-1', 'user-1', 'Main Wallet', 'wallet', '#FF0000');
      expect(account.id).toBe('acc-1');
      expect(account.userId).toBe('user-1');
      expect(account.name).toBe('Main Wallet');
      expect(account.icon).toBe('wallet');
      expect(account.color).toBe('#FF0000');
      expect(account.typeValue).toBe('basic');
      expect(account.order).toBe(0);
      expect(account.balances).toHaveLength(0);
      expect(account.createdAt).toBeInstanceOf(Date);
    });

    it('should create account with initial balances', () => {
      const account = Account.create(
        'acc-1',
        'user-1',
        'Multi Wallet',
        'wallet',
        '#00FF00',
        'basic',
        0,
        [
          { currency: 'USD', balance: 1000 },
          { currency: 'EUR', balance: 500 },
        ],
      );
      expect(account.balances).toHaveLength(2);
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(account.getTotalBalance('EUR')).toBe(500);
    });

    it('should create account with specified type', () => {
      const account = Account.create('acc-1', 'user-1', 'Credit', 'card', '#000', 'credit_card');
      expect(account.typeValue).toBe('credit_card');
    });

    it('should create account with type-specific fields', () => {
      const account = Account.create(
        'acc-1',
        'user-1',
        'My Credit Card',
        'card',
        '#000',
        'credit_card',
        0,
        [],
        { creditLimit: 5000, gracePeriodDays: 30, billingDay: 15 },
      );
      expect(account.creditLimit).toBe(5000);
      expect(account.gracePeriodDays).toBe(30);
      expect(account.billingDay).toBe(15);
    });

    it('should set null for missing type-specific fields', () => {
      const account = Account.create('acc-1', 'user-1', 'Basic', 'wallet', '#000');
      expect(account.creditLimit).toBeNull();
      expect(account.gracePeriodDays).toBeNull();
      expect(account.totalAmount).toBeNull();
      expect(account.interestRate).toBeNull();
    });

    it('should raise AccountCreatedEvent', () => {
      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000');
      expect(account.domainEvents).toHaveLength(1);
      expect(account.domainEvents[0]).toEqual(
        expect.objectContaining({
          accountId: 'acc-1',
          userId: 'user-1',
        }),
      );
    });

    it('should throw on invalid account type', () => {
      expect(() => Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'invalid')).toThrow(
        'Invalid account type',
      );
    });
  });

  describe('credit', () => {
    it('should increase balance for existing currency', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      account.clearDomainEvents();

      account.credit(500, 'USD');
      expect(account.getTotalBalance('USD')).toBe(1500);
    });

    it('should create new balance if currency does not exist', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      account.clearDomainEvents();

      account.credit(200, 'EUR');
      expect(account.getTotalBalance('EUR')).toBe(200);
      expect(account.balances).toHaveLength(2);
    });

    it('should raise BalanceUpdatedEvent on credit', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      account.clearDomainEvents();

      account.credit(500, 'USD');
      expect(account.domainEvents).toHaveLength(1);
    });
  });

  describe('debit', () => {
    it('should decrease balance', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      account.clearDomainEvents();

      account.debit(300, 'USD');
      expect(account.getTotalBalance('USD')).toBe(700);
    });

    it('should allow negative balance', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 100 },
      ]);
      account.debit(200, 'USD');
      expect(account.getTotalBalance('USD')).toBe(-100);
    });

    it('should raise BalanceUpdatedEvent on debit', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      account.clearDomainEvents();

      account.debit(100, 'USD');
      expect(account.domainEvents).toHaveLength(1);
    });
  });

  describe('getBalance', () => {
    it('should return balance for existing currency', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      const balance = account.getBalance('USD');
      expect(balance).toBeDefined();
      expect(balance!.balanceAmount).toBe(1000);
    });

    it('should return undefined for non-existing currency', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      expect(account.getBalance('USD')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      expect(account.getBalance('usd')).toBeDefined();
    });
  });

  describe('getOrCreateBalance', () => {
    it('should return existing balance', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      const balance = account.getOrCreateBalance('USD');
      expect(balance.balanceAmount).toBe(1000);
      expect(account.balances).toHaveLength(1);
    });

    it('should create new balance with zero if not found', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      const balance = account.getOrCreateBalance('EUR');
      expect(balance.balanceAmount).toBe(0);
      expect(balance.currencyCode).toBe('EUR');
      expect(account.balances).toHaveLength(1);
    });

    it('should create new balance with initial amount if specified', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      const balance = account.getOrCreateBalance('EUR', 500);
      expect(balance.balanceAmount).toBe(500);
    });
  });

  describe('getTotalBalance', () => {
    it('should return 0 for missing currency', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      expect(account.getTotalBalance('GBP')).toBe(0);
    });
  });

  describe('update', () => {
    it('should update name', () => {
      const account = Account.create('acc-1', 'user-1', 'Old Name', 'wallet', '#000');
      account.update({ name: 'New Name' });
      expect(account.name).toBe('New Name');
    });

    it('should update multiple fields', () => {
      const account = Account.create('acc-1', 'user-1', 'Old', 'old-icon', '#000');
      account.update({ name: 'New', icon: 'new-icon', color: '#FFF', type: 'savings' });
      expect(account.name).toBe('New');
      expect(account.icon).toBe('new-icon');
      expect(account.color).toBe('#FFF');
      expect(account.typeValue).toBe('savings');
    });

    it('should not change fields that are not provided', () => {
      const account = Account.create('acc-1', 'user-1', 'Name', 'wallet', '#000');
      account.update({ icon: 'new-icon' });
      expect(account.name).toBe('Name');
      expect(account.color).toBe('#000');
    });

    it('should update type-specific fields', () => {
      const account = Account.create('acc-1', 'user-1', 'Card', 'card', '#000', 'credit_card');
      account.update({ creditLimit: 10000, billingDay: 25 });
      expect(account.creditLimit).toBe(10000);
      expect(account.billingDay).toBe(25);
    });
  });

  describe('setOrder', () => {
    it('should update order', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      account.setOrder(5);
      expect(account.order).toBe(5);
    });
  });

  describe('markDeleted', () => {
    it('should raise AccountDeletedEvent', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000');
      account.clearDomainEvents();

      account.markDeleted();
      expect(account.domainEvents).toHaveLength(1);
      expect(account.domainEvents[0]).toEqual(
        expect.objectContaining({
          accountId: 'acc-1',
          userId: 'user-1',
        }),
      );
    });
  });

  describe('balances immutability', () => {
    it('should return a copy of balances array', () => {
      const account = Account.create('acc-1', 'user-1', 'Wallet', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1000 },
      ]);
      const balances1 = account.balances;
      const balances2 = account.balances;
      expect(balances1).not.toBe(balances2);
      expect(balances1).toEqual(balances2);
    });
  });
});
