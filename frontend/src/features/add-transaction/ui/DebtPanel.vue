<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { AccountSelector } from '@/entities/account';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import HeroAmount from './HeroAmount.vue';
import DebtDirectionPill from './DebtDirectionPill.vue';
import DatePickerField from './DatePickerField.vue';
import ToggleRow from './ToggleRow.vue';

const props = defineProps<{
  accounts: AccountWithBalances[];
  defaultAccountId?: string | null;
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  submitted: [];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === formData.value.account_id),
);
const availableCurrencies = computed(() =>
  selectedAccount.value ? selectedAccount.value.balances.map((b) => b.currency) : [],
);
const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);
const currencySymbol = computed(() => getCurrencySymbol(formData.value.currency));

watch(
  [() => props.accounts, () => props.defaultAccountId],
  ([accs, defaultId]) => {
    if (accs.length === 0 || formData.value.account_id) return;
    const preferred = (defaultId && accs.find((a) => a.id === defaultId)) || accs[0];
    updateField('account_id', preferred.id);
    updateField('currency', preferred.balances[0]?.currency || DEFAULT_CURRENCY);
  },
  { immediate: true },
);

function handleAccountChange(accountId: string) {
  trigger('selection');
  const account = props.accounts.find((a) => a.id === accountId);
  const currencies = account?.balances.map((b) => b.currency) || [];
  const currentCurrency = formData.value.currency;
  const newCurrency = currencies.includes(currentCurrency)
    ? currentCurrency
    : currencies[0] || DEFAULT_CURRENCY;
  updateField('account_id', accountId);
  updateField('currency', newCurrency);
}

const isDebtDateOpen = ref(false);
const isDueDateOpen = ref(false);

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
  const sum =
    formData.value.amount > 0 ? `${formData.value.amount} ${formData.value.currency}` : '';
  return formData.value.debt_type === 'given'
    ? `Сумма ${sum} будет списана с выбранного счёта`
    : `Сумма ${sum} будет добавлена на выбранный счёт`;
});
</script>

<template>
  <div class="space-y-3">
    <HeroAmount
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :autofocus="autofocusAmount"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
    />

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

    <div class="grid grid-cols-2 gap-2">
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
