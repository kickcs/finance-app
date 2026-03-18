<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UProgressBar } from '@/shared/ui';
import { formatCurrency, formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useHaptics } from '@/shared/lib/haptics';
import {
  DEBT_DIRECTION_COLORS,
  DEBT_DIRECTION_DISPLAY,
  getDebtDisplayName,
  getDebtProgress,
} from '../model/types';
import type { Debt } from '../model/types';

const props = defineProps<{
  debt: Debt;
  compact?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { trigger } = useHaptics();

function handleClick() {
  trigger('selection');
  emit('click');
}

// Use debt's own currency
const debtCurrency = computed(() => props.debt.currency || DEFAULT_CURRENCY);

const progress = computed(() => getDebtProgress(props.debt));

const nextPaymentFormatted = computed(() => {
  if (!props.debt.next_payment_date) return null;
  return formatDate(props.debt.next_payment_date, { format: 'short' });
});

const isOverdue = computed(
  () => !!props.debt.next_payment_date && isPastDate(props.debt.next_payment_date),
);

const displayName = computed(() => getDebtDisplayName(props.debt));

// Get debt type info
const isGiven = computed(() => props.debt.debt_type === 'given');
const debtColor = computed(() => DEBT_DIRECTION_COLORS[props.debt.debt_type]);
const debtIcon = computed(() => (isGiven.value ? 'arrow_upward' : 'arrow_downward'));
const debtLabel = computed(() => DEBT_DIRECTION_DISPLAY[props.debt.debt_type]);

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
      isOverdue && !debt.is_closed && 'bg-danger/[0.03] !border-danger/15',
    ]"
    :aria-label="
      debt.is_private
        ? `${debtLabel}, скрытый долг`
        : `${debtLabel} ${displayName}, ${formatCurrency(debt.remaining_amount, debtCurrency)}`
    "
    @click="handleClick"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon - now shows debt direction -->
      <div
        class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        :class="isOverdue ? 'bg-danger/10' : ''"
        :style="!isOverdue ? { backgroundColor: `${debtColor}15` } : undefined"
      >
        <UIcon
          :name="debtIcon"
          size="sm"
          :class="isOverdue ? 'text-danger' : ''"
          :style="!isOverdue ? { color: debtColor } : undefined"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate flex items-center gap-1"
            >
              {{ debt.is_private ? '•••' : displayName }}
              <UIcon
                v-if="debt.is_private"
                name="visibility_off"
                size="xs"
                class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
              />
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
              {{ formatMasked(debt.remaining_amount, debtCurrency, debt.is_private) }}
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

        <!-- Progress Bar (only if not closed and has progress) -->
        <UProgressBar
          v-if="progress > 0 && !debt.is_closed"
          :value="progress"
          :color="isOverdue ? 'var(--color-danger)' : debtColor"
          size="xs"
          class="mt-1.5"
        />
      </div>
    </div>
  </button>
</template>
