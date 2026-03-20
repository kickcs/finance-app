import { describe, it, expect } from 'vitest';
import { useTransactionForm } from './useTransactionForm';
import { CATEGORY_IDS } from '@/entities/category';

// ---------------------------------------------------------------------------
// useTransactionForm — pure unit tests (no component mounting needed)
// ---------------------------------------------------------------------------

describe('useTransactionForm', () => {
  // ── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with expense type', () => {
      const { formData } = useTransactionForm();
      expect(formData.value.type).toBe('expense');
    });

    it('starts with zero amount', () => {
      const { formData } = useTransactionForm();
      expect(formData.value.amount).toBe(0);
    });

    it('starts with empty categoryId', () => {
      const { formData } = useTransactionForm();
      expect(formData.value.categoryId).toBe('');
    });

    it('starts with null accountId', () => {
      const { formData } = useTransactionForm();
      expect(formData.value.accountId).toBeNull();
    });

    it('starts as invalid', () => {
      const { isValid } = useTransactionForm();
      expect(isValid.value).toBe(false);
    });
  });

  // ── isValid ──────────────────────────────────────────────────────────────

  describe('isValid', () => {
    it('is invalid when amount is 0', () => {
      const { formData, isValid } = useTransactionForm();
      formData.value.accountId = 'acc-1';
      formData.value.categoryId = 'cat-1';
      formData.value.currency = 'UZS';
      // amount stays 0
      expect(isValid.value).toBe(false);
    });

    it('is invalid when categoryId is empty', () => {
      const { formData, isValid } = useTransactionForm();
      formData.value.accountId = 'acc-1';
      formData.value.amount = 1000;
      formData.value.currency = 'UZS';
      // categoryId stays ''
      expect(isValid.value).toBe(false);
    });

    it('is invalid when accountId is null', () => {
      const { formData, isValid } = useTransactionForm();
      formData.value.amount = 1000;
      formData.value.categoryId = 'cat-1';
      formData.value.currency = 'UZS';
      // accountId stays null
      expect(isValid.value).toBe(false);
    });

    it('is valid when amount, categoryId, accountId and currency are set for expense', () => {
      const { formData, isValid } = useTransactionForm();
      formData.value.type = 'expense';
      formData.value.accountId = 'acc-1';
      formData.value.categoryId = 'cat-groceries';
      formData.value.amount = 5000;
      formData.value.currency = 'UZS';
      expect(isValid.value).toBe(true);
    });

    it('is valid for income with all required fields', () => {
      const { formData, isValid } = useTransactionForm();
      formData.value.type = 'income';
      formData.value.accountId = 'acc-1';
      formData.value.categoryId = 'cat-salary';
      formData.value.amount = 50000;
      formData.value.currency = 'UZS';
      expect(isValid.value).toBe(true);
    });

    describe('transfer validation', () => {
      it('is invalid for transfer without toAccountId', () => {
        const { formData, setType, isValid } = useTransactionForm();
        setType('transfer');
        formData.value.accountId = 'acc-1';
        formData.value.amount = 10000;
        formData.value.currency = 'UZS';
        formData.value.toAmount = 10000;
        formData.value.toCurrency = 'UZS';
        // toAccountId remains null
        expect(isValid.value).toBe(false);
      });

      it('is invalid for same-account same-currency transfer', () => {
        const { formData, setType, isValid } = useTransactionForm();
        setType('transfer');
        formData.value.accountId = 'acc-1';
        formData.value.toAccountId = 'acc-1';
        formData.value.currency = 'UZS';
        formData.value.toCurrency = 'UZS';
        formData.value.amount = 10000;
        formData.value.toAmount = 10000;
        expect(isValid.value).toBe(false);
      });

      it('is valid for same-account different-currency transfer', () => {
        const { formData, setType, isValid } = useTransactionForm();
        setType('transfer');
        formData.value.accountId = 'acc-1';
        formData.value.toAccountId = 'acc-1';
        formData.value.currency = 'UZS';
        formData.value.toCurrency = 'USD';
        formData.value.amount = 100000;
        formData.value.toAmount = 8;
        expect(isValid.value).toBe(true);
      });

      it('is valid for different-account same-currency transfer', () => {
        const { formData, setType, isValid } = useTransactionForm();
        setType('transfer');
        formData.value.accountId = 'acc-1';
        formData.value.toAccountId = 'acc-2';
        formData.value.currency = 'UZS';
        formData.value.toCurrency = 'UZS';
        formData.value.amount = 10000;
        formData.value.toAmount = 10000;
        expect(isValid.value).toBe(true);
      });

      it('is invalid when toAmount is 0', () => {
        const { formData, setType, isValid } = useTransactionForm();
        setType('transfer');
        formData.value.accountId = 'acc-1';
        formData.value.toAccountId = 'acc-2';
        formData.value.currency = 'UZS';
        formData.value.toCurrency = 'USD';
        formData.value.amount = 10000;
        formData.value.toAmount = 0;
        expect(isValid.value).toBe(false);
      });
    });
  });

  // ── setType ──────────────────────────────────────────────────────────────

  describe('setType', () => {
    it('sets type to income', () => {
      const { formData, setType } = useTransactionForm();
      setType('income');
      expect(formData.value.type).toBe('income');
    });

    it('clears categoryId when switching from expense to income', () => {
      const { formData, setType } = useTransactionForm();
      formData.value.categoryId = 'cat-groceries';
      setType('income');
      expect(formData.value.categoryId).toBe('');
    });

    it('sets categoryId to TRANSFER constant when switching to transfer', () => {
      const { formData, setType } = useTransactionForm();
      setType('transfer');
      expect(formData.value.categoryId).toBe(CATEGORY_IDS.TRANSFER);
    });

    it('clears transfer fields when switching away from transfer', () => {
      const { formData, setType } = useTransactionForm();
      setType('transfer');
      formData.value.toAccountId = 'acc-2';
      formData.value.toAmount = 5;
      formData.value.toCurrency = 'USD';
      formData.value.feeAmount = 100;

      setType('expense');

      expect(formData.value.toAccountId).toBeNull();
      expect(formData.value.toAmount).toBeNull();
      expect(formData.value.toCurrency).toBeNull();
      expect(formData.value.feeAmount).toBe(0);
    });
  });

  // ── updateField ──────────────────────────────────────────────────────────

  describe('updateField', () => {
    it('updates a single field without affecting others', () => {
      const { formData, updateField } = useTransactionForm();
      formData.value.accountId = 'acc-1';
      updateField('amount', 9999);
      expect(formData.value.amount).toBe(9999);
      expect(formData.value.accountId).toBe('acc-1');
    });

    it('updates currency field', () => {
      const { formData, updateField } = useTransactionForm();
      updateField('currency', 'USD');
      expect(formData.value.currency).toBe('USD');
    });
  });

  // ── setTransferTarget ────────────────────────────────────────────────────

  describe('setTransferTarget', () => {
    it('sets toAccountId and toCurrency', () => {
      const { formData, setTransferTarget } = useTransactionForm();
      setTransferTarget('acc-2', 'USD');
      expect(formData.value.toAccountId).toBe('acc-2');
      expect(formData.value.toCurrency).toBe('USD');
    });

    it('auto-fills toAmount when currencies match', () => {
      const { formData, setTransferTarget } = useTransactionForm();
      formData.value.currency = 'UZS';
      formData.value.amount = 50000;
      setTransferTarget('acc-2', 'UZS');
      expect(formData.value.toAmount).toBe(50000);
    });

    it('does not auto-fill toAmount when currencies differ', () => {
      const { formData, setTransferTarget } = useTransactionForm();
      formData.value.currency = 'UZS';
      formData.value.amount = 50000;
      setTransferTarget('acc-2', 'USD');
      // toAmount stays null (was null initially)
      expect(formData.value.toAmount).toBeNull();
    });
  });

  // ── resetForm ────────────────────────────────────────────────────────────

  describe('resetForm', () => {
    it('resets all fields to default', () => {
      const { formData, resetForm } = useTransactionForm();
      formData.value.type = 'income';
      formData.value.accountId = 'acc-1';
      formData.value.categoryId = 'cat-1';
      formData.value.amount = 10000;
      formData.value.description = 'Test';

      resetForm();

      expect(formData.value.type).toBe('expense');
      expect(formData.value.accountId).toBeNull();
      expect(formData.value.categoryId).toBe('');
      expect(formData.value.amount).toBe(0);
      expect(formData.value.description).toBe('');
      expect(formData.value.toAccountId).toBeNull();
      expect(formData.value.toAmount).toBeNull();
      expect(formData.value.toCurrency).toBeNull();
      expect(formData.value.feeAmount).toBe(0);
    });

    it('refreshes date to now after reset', () => {
      const { formData, resetForm } = useTransactionForm();
      const oldDate = formData.value.date;
      formData.value.date = 0;
      resetForm();
      // date should be a recent timestamp (within 1 second)
      expect(formData.value.date).toBeGreaterThanOrEqual(oldDate - 1000);
    });
  });
});
