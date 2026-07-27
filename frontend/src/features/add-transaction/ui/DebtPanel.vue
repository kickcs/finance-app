<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon, ToggleRow } from '@/shared/ui';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { sanitizeCurrencyInput, formatCurrency } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { AccountSelector } from '@/entities/account';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import DebtDirectionPill from './DebtDirectionPill.vue';
import DatePickerField from './DatePickerField.vue';

const props = defineProps<{
  /** Сумма, валюта и счёт живут в общей форме — панель только следует за ними. */
  amount: number;
  currency: string;
  accountId: string | null;
  accounts: AccountWithBalances[];
  defaultAccountId?: string | null;
}>();

const emit = defineEmits<{
  submitted: [];
  'update:currency': [value: string];
  /**
   * Счёт долга поднимается в общую форму, чтобы плита знала, из каких валют
   * этого счёта выбирать. Без этого долг на мультивалютном счёте молча
   * залипал на первой валюте.
   */
  'update:accountId': [value: string];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

// Плита — единственный редактор суммы и валюты долга; своя модель подтягивается
// за ней, а обратный ход идёт через `update:currency` при смене счёта.
watch(
  () => props.amount,
  (amount) => updateField('amount', amount),
  { immediate: true },
);
watch(
  () => props.currency,
  (currency) => updateField('currency', currency),
  { immediate: true },
);

/**
 * Счёт берём тот, что уже выбран в форме, а не профильный дефолт: панель
 * монтируется при заходе на вкладку, и подстановка «своего» счёта молча
 * перебивала бы счёт и валюту начатой транзакции другого типа.
 */
watch(
  [() => props.accounts, () => props.accountId],
  ([accs, accountId]) => {
    if (accs.length === 0) return;
    const preferred =
      (accountId && accs.find((a) => a.id === accountId)) ||
      (props.defaultAccountId && accs.find((a) => a.id === props.defaultAccountId)) ||
      accs[0];
    if (formData.value.account_id === preferred.id) return;

    updateField('account_id', preferred.id);
    // Наверх сообщаем, только если счёт пришёл не оттуда — иначе это эхо.
    if (preferred.id !== accountId) {
      emit('update:accountId', preferred.id);
      emit('update:currency', preferred.balances[0]?.currency || DEFAULT_CURRENCY);
    }
  },
  { immediate: true },
);

function handleAccountChange(accountId: string) {
  trigger('selection');
  const account = props.accounts.find((a) => a.id === accountId);
  const currencies = account?.balances.map((b) => b.currency) || [];
  updateField('account_id', accountId);
  emit('update:accountId', accountId);
  if (!currencies.includes(props.currency)) {
    emit('update:currency', currencies[0] || DEFAULT_CURRENCY);
  }
}

const isDebtDateOpen = ref(false);
const isDueDateOpen = ref(false);
const showMore = ref(false);

/** Сколько необязательных полей заполнено — подпись «Ещё» иначе выглядит пустой. */
const extrasCount = computed(
  () =>
    Number(Boolean(formData.value.due_date)) +
    Number(Boolean(formData.value.description.trim())) +
    Number(formData.value.is_private) +
    Number(formData.value.skip_transaction),
);

// Комиссию платит отправитель, поэтому она есть только при выдаче долга.
// Без транзакции списывать нечего — поле тоже прячем.
const showFeeInput = computed(
  () => formData.value.debt_type === 'given' && !formData.value.skip_transaction,
);

const rawFeeValue = ref('');
const isFeeInputFocused = ref(false);
const totalDebited = computed(() => formData.value.amount + formData.value.fee);

function handleFeeInput(raw: string) {
  const sanitized = sanitizeCurrencyInput(raw);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  updateField('fee', Number.isNaN(num) ? 0 : num);
}

function handleFeeBlur() {
  isFeeInputFocused.value = false;
  if (formData.value.fee === 0) rawFeeValue.value = '';
}

// Модель сама обнуляет комиссию при смене направления или отключении
// транзакции — сырое значение инпута должно поехать следом. Пока поле в фокусе
// не трогаем: иначе промежуточные «0» и «0.» стирались бы прямо во время ввода.
watch(
  () => formData.value.fee,
  (fee) => {
    if (isFeeInputFocused.value) return;
    if (fee === 0 && rawFeeValue.value !== '') rawFeeValue.value = '';
  },
);

async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
    trigger('success');
    emit('submitted');
  }
}

const accountLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт',
);
const personLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг',
);
const skipToggleTitle = computed(() =>
  formData.value.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс',
);
const infoText = computed(() => {
  const isGiven = formData.value.debt_type === 'given';
  // При выдаче со счёта уходит долг вместе с комиссией — показываем итог.
  const amount = isGiven ? totalDebited.value : formData.value.amount;
  const sum = formData.value.amount > 0 ? formatCurrency(amount, formData.value.currency) : '';
  return isGiven
    ? `Сумма ${sum} будет списана с выбранного счёта`
    : `Сумма ${sum} будет добавлена на выбранный счёт`;
});
</script>

<template>
  <div class="space-y-3 pb-4 md:pb-8">
    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <div class="space-y-1.5">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ personLabel }}
      </label>
      <PersonSelector
        :model-value="formData.person_name"
        :people="people"
        placeholder="Имя человека"
        @update:model-value="updateField('person_name', $event)"
        @select="updateField('person_name', $event)"
        @save-person="(name) => createPerson({ name })"
      />
    </div>

    <AccountSelector
      :accounts="accounts"
      :selected-id="formData.account_id"
      :label="accountLabel"
      @select="handleAccountChange"
    />

    <div v-if="showFeeInput" class="space-y-1.5">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Комиссия за перевод (необязательно)
      </label>
      <div
        class="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border-light dark:border-border-dark"
      >
        <UIcon
          name="receipt_long"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
        />
        <input
          type="text"
          inputmode="decimal"
          :value="rawFeeValue"
          placeholder="0"
          aria-label="Комиссия за перевод"
          data-testid="debt-fee-input"
          class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums"
          @input="handleFeeInput(($event.target as HTMLInputElement).value)"
          @focus="isFeeInputFocused = true"
          @blur="handleFeeBlur"
        />
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ formData.currency }}
        </span>
      </div>
      <p
        v-if="formData.fee > 0"
        class="px-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
      >
        Со счёта спишется {{ formatCurrency(totalDebited, formData.currency) }} — долг
        {{ formatCurrency(formData.amount, formData.currency) }} + комиссия
        {{ formatCurrency(formData.fee, formData.currency) }}
      </p>
    </div>

    <div class="space-y-1.5">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Дата долга
      </label>
      <DatePickerField
        v-model:open="isDebtDateOpen"
        :model-value="formData.debt_date"
        @update:model-value="updateField('debt_date', $event)"
      />
    </div>

    <!--
      Срок, комментарий и два переключателя заполняют единицы — на виду они
      растягивали панель на два экрана. Счётчик в подписи показывает, что под
      «Ещё» уже что-то задано, иначе настройка теряется из виду.
    -->
    <button
      type="button"
      data-testid="debt-more-toggle"
      :aria-expanded="showMore"
      class="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm text-text-secondary-light transition-colors hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
      @click="showMore = !showMore"
    >
      <span>
        Ещё
        <span v-if="extrasCount" class="text-primary">· {{ extrasCount }}</span>
      </span>
      <UIcon
        name="expand_more"
        size="sm"
        class="more-chevron transition-transform duration-200"
        :class="showMore && 'rotate-180'"
      />
    </button>

    <div v-if="showMore" class="space-y-3">
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Срок возврата
        </label>
        <DatePickerField
          v-model:open="isDueDateOpen"
          :model-value="formData.due_date"
          placeholder="Без срока"
          clearable
          @update:model-value="updateField('due_date', $event)"
        />
      </div>

      <UInput
        :model-value="formData.description"
        label="Комментарий (необязательно)"
        placeholder="Добавьте описание..."
        @update:model-value="updateField('description', $event as string)"
      />

      <ToggleRow
        :model-value="formData.is_private"
        title="Скрыть сумму"
        description="Сумма не будет видна в общем списке"
        @update:model-value="updateField('is_private', $event)"
      />

      <ToggleRow
        :model-value="formData.skip_transaction"
        :title="skipToggleTitle"
        description="Транзакция не будет создана"
        @update:model-value="updateField('skip_transaction', $event)"
      />
    </div>

    <div
      v-if="!formData.skip_transaction && formData.account_id"
      class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="info"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ infoText }}
        </p>
      </div>
    </div>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <div class="pt-2">
      <UButton
        type="button"
        variant="primary"
        size="lg"
        full-width
        :loading="isSubmitting"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        Создать долг
      </UButton>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .more-chevron {
    transition: none;
  }
}
</style>
