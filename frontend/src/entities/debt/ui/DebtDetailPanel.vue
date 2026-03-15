<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon, UCard, UProgressBar, USpinner, IconBadge, UBadge } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useDebts, DEBT_DIRECTION_LABELS, DEBT_DIRECTION_COLORS } from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';

const props = defineProps<{
  debtId: string;
  userId: string;
}>();

defineEmits<{
  payment: [];
  edit: [];
  delete: [];
}>();

// Get debts and accounts
const { debts, isLoading } = useDebts(() => props.userId);
const { accounts } = useAccounts(() => props.userId);

// Find current debt
const debt = computed(() => {
  return debts.value.find((d) => d.id === props.debtId) ?? null;
});

// Use debt's own currency
const debtCurrency = computed(() => debt.value?.currency || DEFAULT_CURRENCY);

// Find linked account
const linkedAccount = computed(() => {
  if (!debt.value?.account_id) return null;
  return accounts.value.find((a) => a.id === debt.value!.account_id) ?? null;
});

// Calculate progress
const progress = computed(() => {
  if (!debt.value || debt.value.total_amount === 0) return 0;
  const paid = debt.value.total_amount - debt.value.remaining_amount;
  return Math.min(100, Math.max(0, Math.round((paid / debt.value.total_amount) * 100)));
});

// Check if overdue
const isOverdue = computed(
  () =>
    !debt.value?.is_closed &&
    !!debt.value?.next_payment_date &&
    isPastDate(debt.value.next_payment_date),
);
</script>

<template>
  <div class="py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <USpinner />
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="!debt"
      class="flex flex-col items-center justify-center py-12 text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <UIcon name="error" size="lg" class="mb-2" />
      <p class="text-body-sm">Долг не найден</p>
    </div>

    <!-- Debt Details -->
    <div v-else class="space-y-6">
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
            <p
              class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ debt.person_name || debt.name }}
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

        <!-- Amount -->
        <div class="mt-6 pt-6 border-t border-border-light dark:border-border-dark">
          <div class="flex justify-between items-end mb-3">
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {{ debt.is_closed ? 'Сумма' : 'Осталось' }}
            </span>
            <span class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(debt.remaining_amount, debtCurrency) }}
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
              {{ formatCurrency(debt.total_amount - debt.remaining_amount, debtCurrency) }}
            </span>
          </div>

          <!-- Progress (only if not closed) -->
          <div
            v-if="!debt.is_closed && debt.remaining_amount < debt.total_amount"
            class="space-y-2 mt-3"
          >
            <UProgressBar :value="progress" :color="DEBT_DIRECTION_COLORS[debt.debt_type]" />
            <div
              class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              <span>Погашено {{ progress }}%</span>
              <span>Всего: {{ formatCurrency(debt.total_amount, debtCurrency) }}</span>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Details Card -->
      <UCard variant="bordered" class="p-5 space-y-4 shadow-sm">
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

        <!-- Original Amount -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Исходная сумма
          </span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(debt.total_amount, debtCurrency) }}
          </span>
        </div>

        <!-- Currency -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Валюта
          </span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ debtCurrency }}
          </span>
        </div>

        <!-- Type -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Тип</span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ debt.debt_type === 'given' ? 'Вам должны' : 'Вы должны' }}
          </span>
        </div>

        <!-- Due Date -->
        <div v-if="debt.next_payment_date" class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Дата возврата
          </span>
          <span
            class="text-sm font-medium"
            :class="
              isOverdue ? 'text-danger' : 'text-text-primary-light dark:text-text-primary-dark'
            "
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

      <!-- Actions (only if not closed) -->
      <div v-if="!debt.is_closed" class="space-y-3">
        <UButton variant="primary" size="lg" full-width @click="$emit('payment')">
          <UIcon name="payments" size="sm" class="mr-1.5" />
          Внести платёж
        </UButton>

        <div class="grid grid-cols-2 gap-3">
          <UButton variant="secondary" size="md" full-width @click="$emit('edit')">
            <UIcon name="edit" size="sm" class="mr-1.5" />
            Редактировать
          </UButton>
          <UButton
            variant="ghost"
            size="md"
            full-width
            class="text-danger"
            @click="$emit('delete')"
          >
            <UIcon name="delete" size="sm" class="mr-1.5" />
            Удалить
          </UButton>
        </div>
      </div>

      <!-- Delete Button for Closed Debts -->
      <div v-else>
        <UButton variant="ghost" size="lg" full-width class="text-danger" @click="$emit('delete')">
          <UIcon name="delete" size="sm" class="mr-2" />
          Удалить долг
        </UButton>
      </div>
    </div>
  </div>
</template>
