import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import {
  suggestDebtOnConversion,
  type AccountType,
  type AccountTypeFieldValues,
} from '@/entities/account';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

export interface EditAccountFormData extends AccountTypeFieldValues {
  name: string;
  icon: string;
  color: string;
  type: AccountType;
}

const EMPTY_TYPE_FIELDS: AccountTypeFieldValues = {
  creditLimit: null,
  gracePeriodDays: null,
  billingDay: null,
  totalAmount: null,
  interestRate: null,
  monthlyPayment: null,
  startDate: null,
  endDate: null,
  maturityDate: null,
  isReplenishable: null,
  isWithdrawable: null,
};

function typeFieldsFromAccount(account: AccountWithBalances | null): AccountTypeFieldValues {
  if (!account) return { ...EMPTY_TYPE_FIELDS };
  return {
    creditLimit: account.credit_limit,
    gracePeriodDays: account.grace_period_days,
    billingDay: account.billing_day,
    totalAmount: account.total_amount,
    interestRate: account.interest_rate,
    monthlyPayment: account.monthly_payment,
    startDate: account.start_date,
    endDate: account.end_date,
    maturityDate: account.maturity_date,
    isReplenishable: account.is_replenishable,
    isWithdrawable: account.is_withdrawable,
  };
}

function fromAccount(account: AccountWithBalances | null): EditAccountFormData {
  return {
    name: account?.name ?? '',
    icon: account?.icon ?? 'account_balance_wallet',
    color: account?.color ?? '#10b981',
    type: (account?.type ?? 'basic') as AccountType,
    ...typeFieldsFromAccount(account),
  };
}

function toUpdates(form: EditAccountFormData): Partial<Account> {
  return {
    name: form.name.trim(),
    icon: form.icon,
    color: form.color,
    type: form.type,
    credit_limit: form.creditLimit,
    grace_period_days: form.gracePeriodDays,
    billing_day: form.billingDay,
    total_amount: form.totalAmount,
    interest_rate: form.interestRate,
    monthly_payment: form.monthlyPayment,
    start_date: form.startDate,
    end_date: form.endDate,
    maturity_date: form.maturityDate,
    is_replenishable: form.isReplenishable,
    is_withdrawable: form.isWithdrawable,
  };
}

/** Незаполненное поле — не ошибка: у типа они все необязательные. */
function isIntegerInRange(value: number | null, min: number, max: number): boolean {
  if (value === null) return true;
  return Number.isInteger(value) && value >= min && value <= max;
}

export function useEditAccountForm(account: MaybeRefOrGetter<AccountWithBalances | null>) {
  const formData = ref<EditAccountFormData>(
    fromAccount(toValue(account)),
  ) as Ref<EditAccountFormData>;
  const debtByCurrency = ref<Record<string, number>>({});
  // Пока пользователь не тронул поле долга сам, оно следует за лимитом.
  const debtTouched = ref(false);

  const originalType = computed(() => (toValue(account)?.type ?? null) as AccountType | null);
  const balances = computed(() => toValue(account)?.balances ?? []);

  const isConverting = computed(
    () => originalType.value !== 'credit_card' && formData.value.type === 'credit_card',
  );

  function seedDebt() {
    const next: Record<string, number> = {};
    balances.value.forEach((b, index) => {
      next[b.currency] =
        index === 0 ? suggestDebtOnConversion(b.balance, formData.value.creditLimit) : 0;
    });
    debtByCurrency.value = next;
  }

  function reset() {
    formData.value = fromAccount(toValue(account));
    debtByCurrency.value = {};
    debtTouched.value = false;
  }

  // Следим за id, а не за самим объектом: фоновый рефетч отдаёт тот же счёт
  // новой ссылкой, и сброс по объекту стирал бы незаконченную правку.
  watch(() => toValue(account)?.id, reset);

  // Смена типа обнуляет чужие поля — иначе в патч уедет ставка от вклада,
  // которую пользователь на кредитке уже не видит. Синхронно, а не в watch:
  // поля типа обычно правят сразу после переключателя, в том же тике.
  function setType(next: AccountType) {
    if (next === formData.value.type) return;
    formData.value.type = next;
    Object.assign(
      formData.value,
      next === originalType.value ? typeFieldsFromAccount(toValue(account)) : EMPTY_TYPE_FIELDS,
    );
    debtTouched.value = false;
    if (next === 'credit_card' && originalType.value !== 'credit_card') seedDebt();
    else debtByCurrency.value = {};
  }

  watch(
    () => formData.value.creditLimit,
    () => {
      if (!isConverting.value || debtTouched.value) return;
      seedDebt();
    },
  );

  const nameError = computed<string | null>(() => {
    const name = formData.value.name;
    if (name.length === 0) return 'Введите название';
    if (name.trim().length === 0) return 'Название не может состоять из пробелов';
    if (name.trim().length < 2) return 'Минимум 2 символа';
    if (name.trim().length > 50) return 'Максимум 50 символов';
    return null;
  });

  // Зеркалит границы UpdateAccountDto: сервер отвечает 400, и без проверки на
  // клиенте пользователь узнаёт об опечатке только из общего тоста.
  const typeFieldsError = computed<string | null>(() => {
    const { gracePeriodDays, billingDay } = formData.value;
    if (!isIntegerInRange(gracePeriodDays, 1, 365)) return 'Грейс-период — целое число от 1 до 365';
    if (!isIntegerInRange(billingDay, 1, 31)) return 'День выписки — целое число от 1 до 31';
    return null;
  });

  const isValid = computed(() => nameError.value === null && typeFieldsError.value === null);

  const isDirty = computed(() => {
    const source = toValue(account);
    if (!source) return false;
    const current = JSON.stringify(toUpdates(formData.value));
    const original = JSON.stringify(toUpdates(fromAccount(source)));
    if (current !== original) return true;
    return Object.values(debtByCurrency.value).some((v) => v !== 0);
  });

  function updateField<K extends keyof EditAccountFormData>(key: K, value: EditAccountFormData[K]) {
    if (key === 'type') {
      setType(value as AccountType);
      return;
    }
    formData.value[key] = value;
  }

  function setDebt(currency: string, value: number) {
    debtTouched.value = true;
    debtByCurrency.value = { ...debtByCurrency.value, [currency]: value };
  }

  function buildUpdates(): Partial<Account> {
    return toUpdates(formData.value);
  }

  return {
    formData,
    debtByCurrency,
    isValid,
    isDirty,
    nameError,
    typeFieldsError,
    isConverting,
    updateField,
    setDebt,
    reset,
    buildUpdates,
  };
}
