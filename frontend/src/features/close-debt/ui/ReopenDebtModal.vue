<script setup lang="ts">
import { computed } from 'vue';
import { UModal, UButton, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { getDebtDisplayName, debtHasClosingRecords } from '@/entities/debt';
import type { AccountWithBalances } from '@/entities/account';
import type { Debt, Transaction } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  debt: Debt | null;
  /** Записи, оставленные закрытием, — их и снимет отмена. */
  closingRecords: Transaction[];
  accounts: AccountWithBalances[];
  isReopening?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
}>();

// Пустой список значит либо «снимать нечего», либо «транзакции ещё не
// приехали». Различает их сам долг: он знает про своё закрытие и прощение.
const expectsRecords = computed(() => debtHasClosingRecords(props.debt));
const recordsUnknown = computed(() => props.closingRecords.length === 0 && expectsRecords.value);

const movedMoney = computed(() => props.closingRecords.some((t) => !t.is_informational));

const affectedAccountNames = computed(() => {
  const ids = new Set(
    props.closingRecords.filter((t) => !t.is_informational).map((t) => t.account_id),
  );
  return [...ids]
    .map((id) => props.accounts.find((a) => a.id === id)?.name)
    .filter((name): name is string => !!name);
});

// Обе подписи собираются строкой, а не кусками шаблона: у скрытого долга нет
// имени, а у транзакции может не найтись счёта, и склейка в разметке оставляла
// бы в тексте лишние пробелы.
const leadNote = computed(() => {
  if (!props.debt) return '';
  const who = props.debt.is_private ? '' : ` ${getDebtDisplayName(props.debt)}`;
  return `Долг${who} вернётся в активные — закроете его заново нужным способом.`;
});

const balanceNote = computed(() => {
  // Пока состав записей неизвестен, обещать нетронутый баланс нельзя: отмена
  // почти наверняка снимет платёж и вернёт деньги на счёт.
  if (recordsUnknown.value) return 'Баланс счёта вернётся к состоянию до закрытия.';
  if (!props.closingRecords.length) return '';
  if (!movedMoney.value) return 'Эти записи информационные — баланса счёта они не касались.';
  const names = affectedAccountNames.value;
  if (names.length === 1) return `Баланс счёта «${names[0]}» вернётся к состоянию до закрытия.`;
  if (names.length > 1) {
    return `Балансы счетов ${names.map((n) => `«${n}»`).join(', ')} вернутся к состоянию до закрытия.`;
  }
  return 'Баланс счёта вернётся к состоянию до закрытия.';
});
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Отменить закрытие"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="debt" class="space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ leadNote }}
      </p>

      <!-- Записи, которые снимет отмена, показаны строками истории — теми
           самыми, которые пользователь и не смог отредактировать. Их может быть
           две: платёж закрытия и отдельная запись прощения остатка -->
      <div class="rounded-xl bg-warning-light border border-warning/20 p-3.5">
        <p class="text-caption-sm font-semibold uppercase tracking-wider text-warning mb-2.5">
          Из истории исчезнет
        </p>
        <div v-if="closingRecords.length" class="space-y-2">
          <div v-for="record in closingRecords" :key="record.id" class="flex items-center gap-3">
            <UIcon name="undo" size="sm" class="shrink-0 text-warning" />
            <span
              class="flex-1 min-w-0 truncate text-sm text-text-primary-light dark:text-text-primary-dark line-through decoration-warning"
            >
              {{ record.description || 'Закрытие долга' }}
            </span>
            <span
              class="shrink-0 text-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark line-through decoration-warning"
            >
              {{ formatCurrency(record.amount, record.currency) }}
            </span>
          </div>
        </div>
        <p
          v-else-if="recordsUnknown"
          class="text-sm text-text-primary-light dark:text-text-primary-dark"
        >
          Записи, которыми долг закрыли, — платёж и, если остаток прощали, запись прощения.
        </p>
        <p v-else class="text-sm text-text-primary-light dark:text-text-primary-dark">
          Записей закрытия нет — отмена только вернёт долг в активные.
        </p>
      </div>

      <p v-if="balanceNote" class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ balanceNote }}
      </p>
    </div>

    <template #actions>
      <UButton variant="secondary" full-width @click="emit('update:modelValue', false)">
        Оставить закрытым
      </UButton>
      <UButton
        variant="primary"
        full-width
        data-testid="confirm-reopen-btn"
        :loading="isReopening"
        @click="emit('confirm')"
      >
        Отменить закрытие
      </UButton>
    </template>
  </UModal>
</template>
