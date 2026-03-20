import { TransferDomainService } from './transfer.domain-service';
import { Account } from '../aggregates/account';

describe('TransferDomainService', () => {
  const createAccount = (
    id: string,
    userId: string,
    balances: { currency: string; balance: number }[] = [],
  ) => {
    return Account.create(id, userId, `Account ${id}`, 'wallet', '#000', 'basic', 0, balances);
  };

  describe('executeTransfer', () => {
    it('should debit from source and credit to destination (same currency)', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      const toAccount = createAccount('acc-2', 'user-1', [{ currency: 'USD', balance: 500 }]);

      const tx = TransferDomainService.executeTransfer({
        id: 'tx-1',
        userId: 'user-1',
        fromAccount,
        toAccount,
        categoryId: 'transfer',
        fromAmount: 300,
        fromCurrency: 'USD',
        toAmount: 300,
        toCurrency: 'USD',
        date: new Date(),
      });

      expect(fromAccount.getTotalBalance('USD')).toBe(700);
      expect(toAccount.getTotalBalance('USD')).toBe(800);
      expect(tx.typeValue).toBe('transfer');
      expect(tx.accountId).toBe('acc-1');
      expect(tx.toAccountId).toBe('acc-2');
    });

    it('should handle cross-currency transfer', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      const toAccount = createAccount('acc-2', 'user-1', [{ currency: 'EUR', balance: 500 }]);

      TransferDomainService.executeTransfer({
        id: 'tx-1',
        userId: 'user-1',
        fromAccount,
        toAccount,
        categoryId: 'transfer',
        fromAmount: 100,
        fromCurrency: 'USD',
        toAmount: 92,
        toCurrency: 'EUR',
        date: new Date(),
      });

      expect(fromAccount.getTotalBalance('USD')).toBe(900);
      expect(toAccount.getTotalBalance('EUR')).toBe(592);
    });

    it('should throw if accounts belong to different users', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);
      const toAccount = createAccount('acc-2', 'user-2', [{ currency: 'USD', balance: 500 }]);

      expect(() =>
        TransferDomainService.executeTransfer({
          id: 'tx-1',
          userId: 'user-1',
          fromAccount,
          toAccount,
          categoryId: 'transfer',
          fromAmount: 100,
          fromCurrency: 'USD',
          toAmount: 100,
          toCurrency: 'USD',
          date: new Date(),
        }),
      ).toThrow('Both accounts must belong to the same user');
    });

    it('should throw if transferring to the same account', () => {
      const account = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 1000 }]);

      expect(() =>
        TransferDomainService.executeTransfer({
          id: 'tx-1',
          userId: 'user-1',
          fromAccount: account,
          toAccount: account,
          categoryId: 'transfer',
          fromAmount: 100,
          fromCurrency: 'USD',
          toAmount: 100,
          toCurrency: 'USD',
          date: new Date(),
        }),
      ).toThrow('Cannot transfer to the same account');
    });

    it('should allow transfer that makes source balance negative', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 50 }]);
      const toAccount = createAccount('acc-2', 'user-1', [{ currency: 'USD', balance: 0 }]);

      TransferDomainService.executeTransfer({
        id: 'tx-1',
        userId: 'user-1',
        fromAccount,
        toAccount,
        categoryId: 'transfer',
        fromAmount: 100,
        fromCurrency: 'USD',
        toAmount: 100,
        toCurrency: 'USD',
        date: new Date(),
      });

      expect(fromAccount.getTotalBalance('USD')).toBe(-50);
      expect(toAccount.getTotalBalance('USD')).toBe(100);
    });
  });

  describe('reverseTransfer', () => {
    it('should reverse a same-currency transfer', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 700 }]);
      const toAccount = createAccount('acc-2', 'user-1', [{ currency: 'USD', balance: 800 }]);

      TransferDomainService.reverseTransfer(fromAccount, toAccount, 300, 'USD', 300, 'USD');

      expect(fromAccount.getTotalBalance('USD')).toBe(1000);
      expect(toAccount.getTotalBalance('USD')).toBe(500);
    });

    it('should reverse a cross-currency transfer', () => {
      const fromAccount = createAccount('acc-1', 'user-1', [{ currency: 'USD', balance: 900 }]);
      const toAccount = createAccount('acc-2', 'user-1', [{ currency: 'EUR', balance: 592 }]);

      TransferDomainService.reverseTransfer(fromAccount, toAccount, 100, 'USD', 92, 'EUR');

      expect(fromAccount.getTotalBalance('USD')).toBe(1000);
      expect(toAccount.getTotalBalance('EUR')).toBe(500);
    });
  });
});
