import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { getTodayISO } from '@/shared/lib/date';
import type { DebtDirection } from './types';

/**
 * Поля формы долга — одни и те же при создании и при правке.
 *
 * Раньше это были две независимые формы с разными именами полей, разной
 * валидацией и разным набором возможностей: комиссию, введённую при создании,
 * нельзя было исправить никогда, а человека в правке выбирали голым инпутом.
 */
export interface DebtFormFields {
  debt_type: DebtDirection;
  person_name: string;
  amount: number;
  currency: string;
  account_id: string | null;
  /** Дата долга, YYYY-MM-DD в локальной зоне — в таком виде её отдаёт календарь. */
  date: string | null;
  /** Срок возврата, ISO — необязателен. */
  due_date: string | null;
  description: string;
  is_private: boolean;
  /** Комиссия за перевод: платится сверх суммы долга и только при выдаче. */
  fee: number;
  /** Долг без движения денег — операция не создаётся. */
  skip_transaction: boolean;
}

export function makeDebtFormFields(initial?: Partial<DebtFormFields> | null): DebtFormFields {
  return {
    debt_type: 'taken',
    person_name: '',
    amount: 0,
    currency: DEFAULT_CURRENCY,
    account_id: null,
    date: getTodayISO(),
    due_date: null,
    description: '',
    is_private: false,
    fee: 0,
    skip_transaction: false,
    ...initial,
  };
}

/** Как долг двигает счёт: выдал — деньги ушли, взял — пришли. */
export function debtTransactionType(direction: DebtDirection): 'expense' | 'income' {
  return direction === 'given' ? 'expense' : 'income';
}

/** Категория операции долга. По ней он опознаётся в истории и аналитике. */
export function debtCategoryId(direction: DebtDirection): string {
  return direction === 'given' ? CATEGORY_IDS.DEBT_GIVEN : CATEGORY_IDS.DEBT_TAKEN;
}

export interface DebtFormModelOptions {
  /** Начальные значения. Меняются — форма пересобирается под них. */
  initial?: MaybeRefOrGetter<Partial<DebtFormFields> | null>;
  /**
   * Обязателен ли счёт. По умолчанию да: деньгам нужно откуда-то уйти. Правка
   * долга без операции — единственный случай, где его можно не выбирать.
   */
  requiresAccount?: MaybeRefOrGetter<boolean>;
}

/**
 * Реактивная модель формы долга: значения, их исходный снимок, валидность и
 * набор изменённых полей. Что делать с изменениями — дело адаптеров:
 * `useDebtForm` создаёт долг, `useEditDebt` шлёт правку.
 */
export function useDebtFormModel(options: DebtFormModelOptions = {}) {
  const fields = ref<DebtFormFields>(makeDebtFormFields(toValue(options.initial)));
  const original = ref<DebtFormFields>({ ...fields.value });

  watch(
    () => toValue(options.initial),
    (next) => {
      if (next) reset(next);
    },
  );

  const isValid = computed(() => {
    const f = fields.value;
    const needsAccount = toValue(options.requiresAccount) ?? true;
    return (
      f.person_name.trim().length > 0 &&
      f.amount > 0 &&
      f.currency !== '' &&
      f.date !== '' &&
      (!needsAccount || f.account_id !== null)
    );
  });

  const changed = computed<Partial<DebtFormFields>>(() => {
    const result: Partial<DebtFormFields> = {};
    for (const key of Object.keys(fields.value) as (keyof DebtFormFields)[]) {
      if (fields.value[key] !== original.value[key]) {
        Object.assign(result, { [key]: fields.value[key] });
      }
    }
    return result;
  });

  const isDirty = computed(() => Object.keys(changed.value).length > 0);

  function updateField<K extends keyof DebtFormFields>(field: K, value: DebtFormFields[K]) {
    fields.value[field] = value;
    // Комиссию платит тот, кто отправляет деньги, и только если операция
    // вообще создаётся — иначе оставшееся значение уехало бы в запрос.
    if (
      (field === 'debt_type' && value !== 'given') ||
      (field === 'skip_transaction' && value === true)
    ) {
      fields.value.fee = 0;
    }
  }

  function reset(next?: Partial<DebtFormFields> | null) {
    const data = makeDebtFormFields(next ?? toValue(options.initial));
    fields.value = data;
    original.value = { ...data };
  }

  return { fields, original, isValid, isDirty, changed, updateField, reset };
}
