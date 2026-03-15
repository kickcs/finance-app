<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UProgressBar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt } from '../model/types';
import { DEBT_DIRECTION_COLORS } from '../model/types';

const props = defineProps<{
  debt: Debt;
  compact?: boolean;
}>();

defineEmits<{
  click: [];
}>();

// Use debt's own currency
const debtCurrency = computed(() => props.debt.currency || DEFAULT_CURRENCY);

const progress = computed(() => {
  if (props.debt.total_amount === 0) return 0;
  const paid = props.debt.total_amount - props.debt.remaining_amount;
  return Math.min((paid / props.debt.total_amount) * 100, 100);
});

const _paid = computed(() => {
  return props.debt.total_amount - props.debt.remaining_amount;
});

const nextPaymentFormatted = computed(() => {
  if (!props.debt.next_payment_date) return null;
  return formatDate(new Date(props.debt.next_payment_date).getTime(), {
    format: 'short',
  });
});

const isOverdue = computed(
  () => !!props.debt.next_payment_date && isPastDate(props.debt.next_payment_date),
);

// Get display name - prefer person_name over name
const displayName = computed(() => {
  return props.debt.person_name || props.debt.name;
});

// Get debt type info
const isGiven = computed(() => props.debt.debt_type === 'given');
const debtColor = computed(() => DEBT_DIRECTION_COLORS[props.debt.debt_type] || '#3b82f6');
const debtIcon = computed(() => (isGiven.value ? 'arrow_upward' : 'arrow_downward'));
const debtLabel = computed(() => (isGiven.value ? 'Вам должны' : 'Вы должны'));

// Check if debt is from split expense
const isFromSplit = computed(() => !!props.debt.source_transaction_id);
</script>

<template>
  <button
    :class="[
      'w-full text-left rounded-xl transition-all duration-200',
      'hover:scale-[1.01] active:scale-[0.99]',
      'bg-card-light dark:bg-card-dark',
      'border border-border-light dark:border-border-dark',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
      compact ? 'p-2.5' : 'p-3',
    ]"
    :aria-label="`${debtLabel} ${displayName}, ${formatCurrency(debt.remaining_amount, debtCurrency)}`"
    @click="$emit('click')"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon - now shows debt direction -->
      <div
        class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        :style="{ backgroundColor: `${isOverdue ? '#ef4444' : debtColor}15` }"
      >
        <UIcon :name="debtIcon" size="sm" :style="{ color: isOverdue ? '#ef4444' : debtColor }" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ displayName }}
            </p>
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center gap-1"
            >
              {{ debtLabel }}
              <span v-if="isFromSplit" class="inline-flex items-center gap-0.5 text-primary">
                <UIcon name="group" size="xs" />
              </span>
            </p>
          </div>
          <!-- Right side: amount + badge -->
          <div class="text-right shrink-0">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(debt.remaining_amount, debtCurrency) }}
            </p>
            <!-- Closed badge or date -->
            <span v-if="debt.is_closed" class="text-xs text-success">Погашен</span>
            <span
              v-else-if="nextPaymentFormatted"
              class="text-xs"
              :class="[
                isOverdue ? 'text-danger' : 'text-text-tertiary-light dark:text-text-tertiary-dark',
              ]"
            >
              {{ nextPaymentFormatted }}
            </span>
          </div>
        </div>

        <!-- Progress Bar (only if not closed) -->
        <UProgressBar
          v-if="!debt.is_closed"
          :value="progress"
          :color="isOverdue ? '#ef4444' : debtColor"
          size="xs"
          class="mt-1.5"
        />
      </div>
    </div>
  </button>
</template>
