<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon, UCard, UProgressBar, UBadge, IconBadge, UToggle } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useHaptics } from '@/shared/lib/haptics';
import {
  DEBT_DIRECTION_LABELS,
  DEBT_DIRECTION_COLORS,
  DEBT_DIRECTION_DISPLAY,
  getDebtDisplayName,
  getDebtProgress,
} from '../model/types';
import DebtPaymentTimeline from './DebtPaymentTimeline.vue';
import type { Debt, Transaction } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  debt: Debt;
  transactions: Transaction[];
  accounts: AccountWithBalances[];
  transactionsLoading: boolean;
}>();

const emit = defineEmits<{
  payment: [];
  edit: [];
  delete: [];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

function handlePayment() {
  trigger('selection');
  emit('payment');
}

function handleEdit() {
  trigger('selection');
  emit('edit');
}

function handleDelete() {
  trigger('selection');
  emit('delete');
}

function handleTogglePrivate(value: boolean) {
  trigger('selection');
  emit('toggle-private', value);
}

// Find linked account
const linkedAccount = computed(() => {
  if (!props.debt.account_id) return null;
  return props.accounts.find((a) => a.id === props.debt.account_id) ?? null;
});

const progress = computed(() => getDebtProgress(props.debt));

// Check if overdue
const isOverdue = computed(
  () =>
    !props.debt.is_closed &&
    !!props.debt.next_payment_date &&
    isPastDate(props.debt.next_payment_date),
);
</script>

<template>
  <div class="space-y-4">
    <!-- Main Card -->
    <UCard class="p-5" variant="bordered">
      <div class="flex items-start gap-4 mb-6">
        <!-- Icon -->
        <IconBadge
          :icon="debt.debt_type === 'given' ? 'arrow_upward' : 'arrow_downward'"
          size="lg"
          :color="DEBT_DIRECTION_COLORS[debt.debt_type]"
          class="shrink-0 shadow-sm"
        />

        <!-- Info -->
        <div class="flex-1 min-w-0 pt-1">
          <p class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ debt.is_private ? '•••' : getDebtDisplayName(debt) }}
          </p>
          <p
            class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mt-0.5"
          >
            {{ DEBT_DIRECTION_LABELS[debt.debt_type] }}
          </p>
        </div>

        <!-- Closed Badge -->
        <UBadge v-if="debt.is_closed" variant="success" shape="pill" class="mt-1">Погашен</UBadge>
      </div>

      <!-- Privacy toggle -->
      <div
        class="flex items-center justify-between py-3 border-b border-border-light dark:border-border-dark"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="visibility_off"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Скрытый долг
          </span>
        </div>
        <UToggle :model-value="debt.is_private" @update:model-value="handleTogglePrivate" />
      </div>

      <!-- Amount Section -->
      <div class="mt-4 pt-4">
        <div class="flex justify-between items-end mb-3">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {{ debt.is_closed ? 'Сумма' : 'Осталось' }}
          </span>
          <span class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {{ formatMasked(debt.remaining_amount, debt.currency, debt.is_private) }}
          </span>
        </div>

        <!-- Paid Amount (if partially paid) -->
        <div
          v-if="debt.remaining_amount < debt.total_amount"
          class="flex justify-between items-center mt-2"
        >
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Уже выплачено
          </span>
          <span class="text-sm font-medium text-success">
            {{
              formatMasked(
                debt.total_amount - debt.remaining_amount,
                debt.currency,
                debt.is_private,
              )
            }}
          </span>
        </div>

        <!-- Progress (only if not closed and partially paid) -->
        <div
          v-if="!debt.is_closed && debt.remaining_amount < debt.total_amount"
          class="space-y-2 mt-3"
        >
          <UProgressBar :value="progress" :color="DEBT_DIRECTION_COLORS[debt.debt_type]" />
          <div
            class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            <span>Погашено {{ progress }}%</span>
            <span>
              Всего: {{ formatMasked(debt.total_amount, debt.currency, debt.is_private) }}
            </span>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Description Block -->
    <div
      v-if="debt.description"
      class="p-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl"
    >
      <p class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mb-1.5">
        Комментарий
      </p>
      <p class="text-sm text-text-primary-light dark:text-text-primary-dark">
        {{ debt.description }}
      </p>
    </div>

    <!-- Payment Timeline -->
    <DebtPaymentTimeline
      :debt="debt"
      :transactions="transactions"
      :is-loading="transactionsLoading"
    />

    <!-- Details Card -->
    <UCard variant="bordered" class="p-5 space-y-4 shadow-sm">
      <!-- Original Amount -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Исходная сумма
        </span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ formatMasked(debt.total_amount, debt.currency, debt.is_private) }}
        </span>
      </div>

      <!-- Currency -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Валюта</span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ debt.currency }}
        </span>
      </div>

      <!-- Debt Type -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Тип долга
        </span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ DEBT_DIRECTION_DISPLAY[debt.debt_type] }}
        </span>
      </div>

      <!-- Linked Account -->
      <div v-if="linkedAccount" class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Счёт</span>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: linkedAccount.color }" />
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ linkedAccount.name }}
          </span>
        </div>
      </div>

      <!-- Due Date -->
      <div v-if="debt.next_payment_date" class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Дата возврата
        </span>
        <span
          class="text-sm font-medium"
          :class="isOverdue ? 'text-danger' : 'text-text-primary-light dark:text-text-primary-dark'"
        >
          {{ formatDate(debt.next_payment_date, { format: 'short' }) }}
          <span v-if="isOverdue" class="text-xs">(просрочено)</span>
        </span>
      </div>

      <!-- Created Date -->
      <div class="flex items-center justify-between">
        <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Дата создания
        </span>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ formatDate(debt.created_at, { format: 'short' }) }}
        </span>
      </div>
    </UCard>

    <!-- Actions -->
    <div v-if="!debt.is_closed" class="space-y-3">
      <UButton
        variant="primary"
        size="lg"
        full-width
        data-testid="payment-btn"
        @click="handlePayment"
      >
        <UIcon name="payments" size="sm" class="mr-1.5" />
        Внести платёж
      </UButton>

      <div class="grid grid-cols-2 gap-3">
        <UButton variant="secondary" size="md" full-width @click="handleEdit">
          <UIcon name="edit" size="sm" class="mr-1.5" />
          Редактировать
        </UButton>
        <UButton
          variant="ghost"
          size="md"
          full-width
          class="text-danger"
          data-testid="delete-debt-btn"
          @click="handleDelete"
        >
          <UIcon name="delete" size="sm" class="mr-1.5" />
          Удалить
        </UButton>
      </div>
    </div>

    <!-- Delete Button for Closed Debts -->
    <UButton v-else variant="ghost" size="lg" full-width class="text-danger" @click="handleDelete">
      <UIcon name="delete" size="sm" class="mr-2" />
      Удалить долг
    </UButton>
  </div>
</template>
