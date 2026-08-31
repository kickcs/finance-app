import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import {
  useDebtFormModel,
  makeDebtFormFields,
  debtCategoryId,
  debtTransactionType,
  type DebtFormFields,
} from './useDebtFormModel';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';

describe('debtCategoryId / debtTransactionType', () => {
  it('выданный долг — расход в категории «дал в долг»', () => {
    expect(debtTransactionType('given')).toBe('expense');
    expect(debtCategoryId('given')).toBe(CATEGORY_IDS.DEBT_GIVEN);
  });

  it('взятый долг — доход в категории «взял в долг»', () => {
    expect(debtTransactionType('taken')).toBe('income');
    expect(debtCategoryId('taken')).toBe(CATEGORY_IDS.DEBT_TAKEN);
  });
});

describe('useDebtFormModel', () => {
  const filled: Partial<DebtFormFields> = {
    person_name: 'Алексей',
    amount: 1000,
    account_id: 'acc-1',
  };

  describe('валидация', () => {
    it('пустая форма невалидна', () => {
      const { isValid } = useDebtFormModel();
      expect(isValid.value).toBe(false);
    });

    it('заполненная — валидна', () => {
      const { isValid } = useDebtFormModel({ initial: filled });
      expect(isValid.value).toBe(true);
    });

    it('имя из одних пробелов не считается', () => {
      const { isValid } = useDebtFormModel({ initial: { ...filled, person_name: '   ' } });
      expect(isValid.value).toBe(false);
    });

    it('нулевая сумма не проходит', () => {
      const { isValid } = useDebtFormModel({ initial: { ...filled, amount: 0 } });
      expect(isValid.value).toBe(false);
    });

    it('без счёта не проходит', () => {
      const { isValid } = useDebtFormModel({ initial: { ...filled, account_id: null } });
      expect(isValid.value).toBe(false);
    });

    it('счёт можно не выбирать там, где деньги не двигаются', () => {
      const { isValid } = useDebtFormModel({
        initial: { ...filled, account_id: null },
        requiresAccount: false,
      });
      expect(isValid.value).toBe(true);
    });
  });

  describe('комиссия', () => {
    it('обнуляется при смене направления на «взял»', () => {
      const { fields, updateField } = useDebtFormModel({
        initial: { ...filled, debt_type: 'given', fee: 500 },
      });

      updateField('debt_type', 'taken');

      expect(fields.value.fee).toBe(0);
    });

    it('обнуляется, когда операцию решили не создавать', () => {
      const { fields, updateField } = useDebtFormModel({
        initial: { ...filled, debt_type: 'given', fee: 500 },
      });

      updateField('skip_transaction', true);

      expect(fields.value.fee).toBe(0);
    });

    it('остаётся при выдаче с операцией', () => {
      const { fields, updateField } = useDebtFormModel({ initial: { ...filled, fee: 500 } });

      updateField('debt_type', 'given');

      expect(fields.value.fee).toBe(500);
    });
  });

  describe('изменения', () => {
    it('форма без правок чистая', () => {
      const { isDirty, changed } = useDebtFormModel({ initial: filled });
      expect(isDirty.value).toBe(false);
      expect(changed.value).toEqual({});
    });

    it('в changed попадают только тронутые поля', () => {
      const { changed, isDirty, updateField } = useDebtFormModel({ initial: filled });

      updateField('amount', 2000);

      expect(isDirty.value).toBe(true);
      expect(changed.value).toEqual({ amount: 2000 });
    });

    it('возврат к исходному значению снова делает форму чистой', () => {
      const { isDirty, updateField } = useDebtFormModel({ initial: filled });

      updateField('amount', 2000);
      updateField('amount', 1000);

      expect(isDirty.value).toBe(false);
    });

    it('reset откатывает правки', () => {
      const { fields, isDirty, updateField, reset } = useDebtFormModel({ initial: filled });

      updateField('person_name', 'Другой');
      reset();

      expect(fields.value.person_name).toBe('Алексей');
      expect(isDirty.value).toBe(false);
    });
  });

  it('пересобирается под новый источник', async () => {
    const source = ref<Partial<DebtFormFields> | null>(filled);
    const { fields, isDirty } = useDebtFormModel({ initial: source });

    source.value = { ...filled, person_name: 'Мария', amount: 300 };
    await nextTick();

    expect(fields.value.person_name).toBe('Мария');
    expect(fields.value.amount).toBe(300);
    // Новый источник — новый исходный снимок, иначе форма «грязная» с порога
    expect(isDirty.value).toBe(false);
  });

  it('makeDebtFormFields даёт разумные значения по умолчанию', () => {
    const fields = makeDebtFormFields();
    expect(fields.debt_type).toBe('taken');
    expect(fields.fee).toBe(0);
    expect(fields.skip_transaction).toBe(false);
    expect(fields.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
