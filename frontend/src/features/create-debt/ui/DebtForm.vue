<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { DEBT_DIRECTION_LABELS, type DebtDirection } from '@/entities/debt';
import { getCurrencyByCode, DEFAULT_CURRENCY } from '@/entities/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { getTodayISO } from '@/shared/lib/date';
import { formatLocalDate } from '@/shared/lib/format/date';
import type { DebtFormData } from '../model/useCreateDebt';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  formData: DebtFormData;
  accounts: AccountWithBalances[];
  isSubmitting?: boolean;
  error?: string | null;
}>();
const emit = defineEmits<{
  'update:formData': [value: DebtFormData];
  submit: [];
}>();
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);

const debtTypeTabs = Object.entries(DEBT_DIRECTION_LABELS).map(([id, label]) => ({
  id,
  label,
}));

// Get selected account
const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === props.formData.account_id),
);

// Get available currencies for selected account
const availableCurrencies = computed(() => {
  if (!selectedAccount.value) return [];
  return selectedAccount.value.balances.map((b) => b.currency);
});

// Check if account has multiple currencies
const isMultiCurrency = computed(() => availableCurrencies.value.length > 1);

// Get currency symbol for display
const currencySymbol = computed(() => {
  const currency = getCurrencyByCode(props.formData.currency);
  return currency?.symbol || props.formData.currency;
});

function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value });
}

function handleAccountChange(accountId: string) {
  const account = props.accounts.find((a) => a.id === accountId);
  const firstCurrency = account?.balances[0]?.currency || DEFAULT_CURRENCY;

  emit('update:formData', {
    ...props.formData,
    account_id: accountId,
    currency: firstCurrency,
  });
}

function handleCurrencyChange(currency: string) {
  emit('update:formData', {
    ...props.formData,
    currency,
  });
}

// Date picker
const isDatePickerOpen = ref(false);

// Convert string date to CalendarDate
function parseDate(dateStr: string | null): DateValue | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new CalendarDate(year, month, day);
}

// Get current date value for calendar
const calendarValue = computed(() => {
  const dateStr = props.formData.debt_date || getTodayISO();
  return parseDate(dateStr);
});

// Handle calendar date change
function handleDateChange(value: DateValue | undefined) {
  if (value) {
    const year = value.year;
    const month = String(value.month).padStart(2, '0');
    const day = String(value.day).padStart(2, '0');
    updateField('debt_date', `${year}-${month}-${day}`);
    isDatePickerOpen.value = false;
  }
}

// Format date for display
const displayDate = computed(() => {
  const dateStr = props.formData.debt_date || getTodayISO();
  const [year, month, day] = dateStr.split('-').map(Number);
  return formatLocalDate(new Date(year, month - 1, day).getTime());
});
</script>

<template>
  <form
    class="space-y-6 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Debt Type Tabs -->
    <div class="space-y-3">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Тип долга
      </label>
      <UTabs
        :model-value="formData.debt_type"
        :items="debtTypeTabs"
        @update:model-value="updateField('debt_type', $event as DebtDirection)"
      />
    </div>

    <!-- Person Name -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ formData.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг' }}
      </label>

      <PersonSelector
        :model-value="formData.person_name"
        :people="people"
        placeholder="Имя человека"
        @update:model-value="updateField('person_name', $event as string)"
        @select="updateField('person_name', $event as string)"
        @save-person="(name) => createPerson({ name })"
      />
    </div>

    <!-- Amount with Currency -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Сумма
      </label>
      <div class="flex gap-2">
        <!-- Currency Selector (only for multi-currency accounts) -->
        <div v-if="isMultiCurrency" class="relative shrink-0">
          <select
            :value="formData.currency"
            class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-xl px-3 pr-8 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary"
            @change="handleCurrencyChange(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="currency in availableCurrencies" :key="currency" :value="currency">
              {{ getCurrencyByCode(currency)?.flag }} {{ currency }}
            </option>
          </select>
          <UIcon
            name="expand_more"
            size="sm"
            class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>

        <!-- Amount Input -->
        <div class="flex-1">
          <UInput
            :model-value="String(formData.amount || '')"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="currencySymbol"
            @update:model-value="updateField('amount', Number($event) || 0)"
          />
        </div>
      </div>
    </div>

    <!-- Account Selector -->
    <div class="space-y-3">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ formData.debt_type === 'given' ? 'С какого счёта' : 'На какой счёт' }}
      </label>
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          :class="[
            'flex items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all',
            'border',
            formData.account_id === account.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
          ]"
          @click="handleAccountChange(account.id)"
        >
          <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: account.color }" />
          <span class="truncate">{{ account.name }}</span>
          <span v-if="account.balances.length > 1" class="text-xs opacity-60">
            ({{ account.balances.length }} валют)
          </span>
        </button>
      </div>
    </div>

    <!-- Date Input -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        Дата
      </label>
      <Popover v-model:open="isDatePickerOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="calendar_month"
                size="sm"
                class="text-text-secondary-light dark:text-text-secondary-dark"
              />
              <span class="text-sm">{{ displayDate }}</span>
            </div>
            <UIcon
              name="expand_more"
              size="sm"
              class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
              :class="{ 'rotate-180': isDatePickerOpen }"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <Calendar
            :model-value="calendarValue"
            locale="ru-RU"
            @update:model-value="handleDateChange"
          />
        </PopoverContent>
      </Popover>
    </div>

    <!-- Description (optional) -->
    <UInput
      :model-value="formData.description"
      label="Комментарий (необязательно)"
      placeholder="Добавьте описание..."
      @update:model-value="updateField('description', $event as string)"
    />

    <!-- Skip Balance Checkbox -->
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        :checked="formData.skipTransaction"
        class="w-5 h-5 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
        @change="updateField('skipTransaction', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-sm text-text-primary-light dark:text-text-primary-dark">
        {{ formData.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс' }}
      </span>
    </label>

    <!-- Info Box -->
    <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
      <div class="flex items-start gap-3">
        <UIcon
          name="info"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
        />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          <template v-if="formData.skipTransaction">
            Будет создан только долг без изменения баланса счёта
          </template>
          <template v-else>
            {{
              formData.debt_type === 'given'
                ? `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет списана с выбранного счёта`
                : `Сумма ${formData.amount > 0 ? formData.amount + ' ' + formData.currency : ''} будет добавлена на выбранный счёт`
            }}
          </template>
        </p>
      </div>
    </div>

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Submit Button -->
    <UButton
      type="submit"
      variant="primary"
      size="xl"
      full-width
      :loading="isSubmitting"
      :disabled="!formData.person_name.trim() || formData.amount <= 0 || !formData.account_id"
    >
      Создать долг
    </UButton>
  </form>
</template>
