<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import type { Debt } from '@/shared/api/database.types';
import { DEBT_DIRECTION_DISPLAY, getDebtDisplayName } from '../model/types';

const props = defineProps<{
  debt: Debt;
  userCurrency: string;
}>();

defineEmits<{
  click: [];
}>();

const isForgiven = computed(() => props.debt.forgiven_amount > 0);
const displayName = computed(() => getDebtDisplayName(props.debt));

const durationDays = computed(() => {
  if (!props.debt.closed_at) return null;
  const start = new Date(props.debt.created_at).getTime();
  const end = new Date(props.debt.closed_at).getTime();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
});

const showCurrencyBadge = computed(() => props.debt.currency !== props.userCurrency);
</script>

<template>
  <button
    class="w-full text-left p-3.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark active:scale-[0.99] transition-all duration-150 opacity-85"
    :aria-label="`${displayName}, ${formatCurrency(debt.total_amount, debt.currency)}, погашен`"
    @click="$emit('click')"
  >
    <!-- Top row: avatar + name + amount -->
    <div class="flex items-center gap-2.5 mb-2.5">
      <div
        class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        :class="isForgiven ? 'bg-warning/10' : 'bg-success/10'"
      >
        <UIcon
          :name="isForgiven ? 'volunteer_activism' : 'check_circle'"
          size="sm"
          :class="isForgiven ? 'text-warning' : 'text-success'"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ displayName }}
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ DEBT_DIRECTION_DISPLAY[debt.debt_type] }}
        </p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ formatCurrency(debt.total_amount, debt.currency) }}
        </p>
        <span v-if="isForgiven" class="text-xs text-warning font-medium">Прощён</span>
        <span
          v-if="showCurrencyBadge"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark ml-1"
        >
          {{ debt.currency }}
        </span>
      </div>
    </div>

    <!-- Mini timeline bar -->
    <div
      class="flex items-center gap-2 pt-2.5 border-t border-border-light/50 dark:border-border-dark/50"
    >
      <span class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
        {{ formatDate(debt.created_at, { format: 'short' }) }}
      </span>
      <div
        class="flex-1 h-0.5 rounded-full overflow-hidden"
        :class="isForgiven ? 'bg-warning/20' : 'bg-success/20'"
      >
        <div class="h-full w-full rounded-full" :class="isForgiven ? 'bg-warning' : 'bg-success'" />
      </div>
      <span
        class="text-[10px] font-medium shrink-0"
        :class="isForgiven ? 'text-warning' : 'text-success'"
      >
        {{ debt.closed_at ? formatDate(debt.closed_at, { format: 'short' }) : '' }}
      </span>
    </div>

    <!-- Summary line -->
    <div class="flex justify-between mt-1">
      <span class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark">Создан</span>
      <span class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ durationDays ? `${durationDays} дн.` : '' }}
        {{ isForgiven ? ' · Прощён' : '' }}
      </span>
      <span class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark">Закрыт</span>
    </div>
  </button>
</template>
