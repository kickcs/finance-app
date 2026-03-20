import { BalanceCalculationService } from './balance-calculation.service';
import { Account } from '../aggregates/account';
import { Transaction } from '../aggregates/transaction';

describe('BalanceCalculationService', () => {
  const now = new Date();

  const createAccount = (balance: number, currency = 'USD') => {
    return Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
      { currency, balance },
    ]);
  };

  describe('applyTransaction', () => {
    it('should credit account for income', () => {
      const account = createAccount(1000);
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);

      BalanceCalculationService.applyTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1500);
    });

    it('should debit account for expense', () => {
      const account = createAccount(1000);
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);

      BalanceCalculationService.applyTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(700);
    });

    it('should debit source account for transfer', () => {
      const account = createAccount(1000);
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'cat-t',
        400,
        'USD',
        400,
        'USD',
        now,
      );

      BalanceCalculationService.applyTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(600);
    });

    it('should credit for positive adjustment (isDebtRelated=false)', () => {
      const account = createAccount(1000);
      const tx = Transaction.createAdjustment('tx-1', 'user-1', 'acc-1', 200, 'USD', now, false);

      BalanceCalculationService.applyTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1200);
    });

    it('should debit for negative adjustment (isDebtRelated=true)', () => {
      const account = createAccount(1000);
      const tx = Transaction.createAdjustment('tx-1', 'user-1', 'acc-1', 200, 'USD', now, true);

      BalanceCalculationService.applyTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(800);
    });
  });

  describe('reverseTransaction', () => {
    it('should reverse income (debit)', () => {
      const account = createAccount(1500);
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);

      BalanceCalculationService.reverseTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });

    it('should reverse expense (credit)', () => {
      const account = createAccount(700);
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);

      BalanceCalculationService.reverseTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });

    it('should reverse transfer source (credit back)', () => {
      const account = createAccount(600);
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-1',
        'acc-2',
        'cat-t',
        400,
        'USD',
        400,
        'USD',
        now,
      );

      BalanceCalculationService.reverseTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });

    it('should reverse positive adjustment (debit)', () => {
      const account = createAccount(1200);
      const tx = Transaction.createAdjustment('tx-1', 'user-1', 'acc-1', 200, 'USD', now, false);

      BalanceCalculationService.reverseTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });

    it('should reverse negative adjustment (credit)', () => {
      const account = createAccount(800);
      const tx = Transaction.createAdjustment('tx-1', 'user-1', 'acc-1', 200, 'USD', now, true);

      BalanceCalculationService.reverseTransaction(account, tx);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });
  });

  describe('applyTransferReceive', () => {
    it('should credit the destination account', () => {
      const account = createAccount(500, 'EUR');
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-1',
        'cat-t',
        100,
        'USD',
        92,
        'EUR',
        now,
      );

      BalanceCalculationService.applyTransferReceive(account, tx);
      expect(account.getTotalBalance('EUR')).toBe(592);
    });

    it('should throw if transaction is not a transfer', () => {
      const account = createAccount(1000);
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);

      expect(() => {
        BalanceCalculationService.applyTransferReceive(account, tx);
      }).toThrow('Transaction is not a transfer or missing toAmount');
    });
  });

  describe('reverseTransferReceive', () => {
    it('should debit the destination account', () => {
      const account = createAccount(592, 'EUR');
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-1',
        'cat-t',
        100,
        'USD',
        92,
        'EUR',
        now,
      );

      BalanceCalculationService.reverseTransferReceive(account, tx);
      expect(account.getTotalBalance('EUR')).toBe(500);
    });
  });

  describe('calculateUpdateDelta', () => {
    it('should calculate delta for income amount change', () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);
      const result = BalanceCalculationService.calculateUpdateDelta(tx, { amount: 700 });

      expect(result.oldEffect).toBe(500);
      expect(result.newEffect).toBe(700);
      expect(result.currency).toBe('USD');
    });

    it('should calculate delta for type change from income to expense', () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      const result = BalanceCalculationService.calculateUpdateDelta(tx, { type: 'expense' });

      expect(result.oldEffect).toBe(100);
      expect(result.newEffect).toBe(-100);
    });

    it('should return 0 effect for transfer type', () => {
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
      const result = BalanceCalculationService.calculateUpdateDelta(tx, {});

      expect(result.oldEffect).toBe(0);
      expect(result.newEffect).toBe(0);
    });
  });
});
