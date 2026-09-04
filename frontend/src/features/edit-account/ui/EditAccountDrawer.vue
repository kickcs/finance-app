<script setup lang="ts">
import { computed, watch } from 'vue';
import { UOverlay, UInput, UButton, UIconSelector, UColorPicker, IconBadge } from '@/shared/ui';
import {
  AccountTypeSelector,
  AccountTypeFields,
  ACCOUNT_ICONS,
  getAccountTypeLabel,
  type AccountTypeFieldValues,
} from '@/entities/account';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import type { Account, AccountBalance, AccountWithBalances } from '@/shared/api/database.types';
import { useEditAccountForm } from '../model/useEditAccountForm';

const props = defineProps<{
  modelValue: boolean;
  account: AccountWithBalances | null;
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Account>, debtByCurrency?: Record<string, number>];
}>();

const {
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
} = useEditAccountForm(() => props.account);

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// Сброс на открытии, а не на закрытии: иначе поля успевают дёрнуться назад
// прямо во время затухания шторки.
watch(open, (isOpen) => {
  if (isOpen) reset();
});

const balances = computed(() => props.account?.balances ?? []);

const previewName = computed(() => formData.value.name.trim() || 'Без названия');
const previewIsPlaceholder = computed(() => formData.value.name.trim().length === 0);

// Порог и правило пропуска зеркалят useEditAccount.update: валюту трогаем,
// только если долг положительный или баланс уже ушёл в минус.
const BALANCE_EPSILON = 0.01;

/** Что станет с балансом этой валюты после сохранения. */
function outcomeFor(balance: AccountBalance): string {
  const debt = debtByCurrency.value[balance.currency] ?? 0;
  const owed = Number.isFinite(debt) && debt > 0 ? debt : 0;
  if (owed === 0 && balance.balance >= 0) return 'Баланс не изменится';
  const target = owed === 0 ? 0 : -owed;
  if (Math.abs(target - balance.balance) < BALANCE_EPSILON) return 'Баланс не изменится';
  return `Баланс станет ${formatCurrency(target, balance.currency)}`;
}

function debtValue(currency: string): string {
  const debt = debtByCurrency.value[currency];
  return typeof debt === 'number' ? String(debt) : '';
}

function handleSubmit() {
  if (!isValid.value || !isDirty.value) return;
  emit('confirm', buildUpdates(), isConverting.value ? { ...debtByCurrency.value } : undefined);
}
</script>

<template>
  <UOverlay v-model="open" title="Редактировать счёт" desktop="panel">
    <div v-if="account" class="space-y-5" data-testid="edit-account-form">
      <!-- Живой предпросмотр: цвет и иконка видны в контексте строки счёта -->
      <div
        data-testid="account-preview"
        class="flex items-center gap-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-3"
      >
        <IconBadge :icon="formData.icon" :color="formData.color" size="lg" />
        <div class="min-w-0">
          <p
            class="text-sm font-medium truncate"
            :class="
              previewIsPlaceholder
                ? 'text-text-tertiary-light dark:text-text-tertiary-dark'
                : 'text-text-primary-light dark:text-text-primary-dark'
            "
          >
            {{ previewName }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
            {{ getAccountTypeLabel(formData.type) }}
          </p>
        </div>
      </div>

      <!-- Название -->
      <UInput
        data-testid="account-name-input"
        :model-value="formData.name"
        label="Название"
        placeholder="Наличные, Карта..."
        :error="nameError ?? undefined"
        @update:model-value="updateField('name', String($event))"
      />

      <!-- Тип -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Тип счёта
        </label>
        <AccountTypeSelector
          :model-value="formData.type"
          @update:model-value="updateField('type', $event)"
        />
      </div>

      <!-- Поля типа (у поля лимита внутри есть data-testid="credit-limit-input") -->
      <AccountTypeFields
        :type="formData.type"
        :fields="formData"
        @update:field="
          (key, value) => updateField(key as keyof AccountTypeFieldValues, value as never)
        "
      />

      <p v-if="typeFieldsError" data-testid="type-fields-error" class="text-xs text-danger">
        {{ typeFieldsError }}
      </p>

      <!-- Конвертация в кредитку -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition-all duration-150 ease-in"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="isConverting"
          data-testid="conversion-block"
          class="space-y-3 rounded-xl border border-border-light dark:border-border-dark p-3"
        >
          <div>
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Задолженность сейчас
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Если на счёте лежит доступный остаток по карте, долг = лимит − остаток. Баланс
              выставим корректирующей операцией.
            </p>
          </div>

          <div
            v-for="balance in balances"
            :key="balance.currency"
            :data-testid="`debt-input-${balance.currency}`"
            class="space-y-1"
          >
            <UInput
              :model-value="debtValue(balance.currency)"
              variant="currency"
              :suffix="getCurrencySymbol(balance.currency)"
              :label="`На счёте ${formatCurrency(balance.balance, balance.currency)}`"
              placeholder="0"
              @update:model-value="setDebt(balance.currency, Number($event) || 0)"
            />
            <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {{ outcomeFor(balance) }}
            </p>
          </div>
        </div>
      </Transition>

      <!-- Иконка и цвет -->
      <UIconSelector
        :model-value="formData.icon"
        :icons="ACCOUNT_ICONS"
        :color="formData.color"
        label="Иконка"
        @update:model-value="updateField('icon', $event)"
      />
      <UColorPicker
        :model-value="formData.color"
        :colors="ENTITY_COLORS"
        label="Цвет"
        @update:model-value="updateField('color', $event)"
      />
    </div>

    <template #footer>
      <UButton
        data-testid="save-btn"
        variant="primary"
        size="xl"
        full-width
        :loading="isUpdating"
        :disabled="!isValid || !isDirty"
        @click="handleSubmit"
      >
        Сохранить
      </UButton>
    </template>
  </UOverlay>
</template>
