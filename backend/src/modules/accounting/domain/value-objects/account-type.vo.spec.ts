import { AccountType } from './account-type.vo';

describe('AccountType Value Object', () => {
  it('should create a valid basic account type', () => {
    const type = AccountType.create('basic');
    expect(type.value).toBe('basic');
    expect(type.isBasic()).toBe(true);
  });

  it('should create all valid account types', () => {
    const validTypes = ['basic', 'savings', 'credit_card', 'cash', 'loan', 'deposit'];
    for (const t of validTypes) {
      const accountType = AccountType.create(t);
      expect(accountType.value).toBe(t);
    }
  });

  it('should throw on invalid account type', () => {
    expect(() => AccountType.create('checking')).toThrow('Invalid account type: checking');
  });

  it('should throw on empty string', () => {
    expect(() => AccountType.create('')).toThrow('Invalid account type');
  });

  it('should correctly identify type via helper methods', () => {
    expect(AccountType.create('savings').isSavings()).toBe(true);
    expect(AccountType.create('savings').isBasic()).toBe(false);
    expect(AccountType.create('credit_card').isCreditCard()).toBe(true);
    expect(AccountType.create('cash').isCash()).toBe(true);
    expect(AccountType.create('loan').isLoan()).toBe(true);
    expect(AccountType.create('deposit').isDeposit()).toBe(true);
  });

  it('should have correct toString', () => {
    expect(AccountType.create('basic').toString()).toBe('basic');
  });

  it('should support equality via ValueObject base', () => {
    const a = AccountType.create('basic');
    const b = AccountType.create('basic');
    expect(a.equals(b)).toBe(true);
  });

  it('should not be equal for different types', () => {
    const a = AccountType.create('basic');
    const b = AccountType.create('savings');
    expect(a.equals(b)).toBe(false);
  });

  it('should have static instances', () => {
    expect(AccountType.BASIC.value).toBe('basic');
    expect(AccountType.SAVINGS.value).toBe('savings');
    expect(AccountType.CREDIT_CARD.value).toBe('credit_card');
    expect(AccountType.CASH.value).toBe('cash');
    expect(AccountType.LOAN.value).toBe('loan');
    expect(AccountType.DEPOSIT.value).toBe('deposit');
  });
});
