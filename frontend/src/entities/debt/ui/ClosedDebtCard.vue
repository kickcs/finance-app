<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency, formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { useHaptics } from '@/shared/lib/haptics';
import type { Debt } from '@/shared/api/database.types';
import { DEBT_DIRECTION_DISPLAY, getDebtDisplayName } from '../model/types';

const props = defineProps<{
  debt: Debt;
  userCurrency: string;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { trigger } = useHaptics();

function handleClick() {
  trigger('selection');
  emit('click');
}

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
    class="w-full text-left p-3.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark active:scale-[0.99] transition-all duration-150"
    :aria-label="
      debt.is_private
        ? `${DEBT_DIRECTION_DISPLAY[debt.debt_type]}, скрытый долг, погашен`
        : `${displayName}, ${formatCurrency(debt.total_amount, debt.currency)}, погашен`
    "
    @click="handleClick"
  >
    <!-- Top row: avatar + name + amount -->
    <div class="flex items-center gap-2.5 mb-2.5">
      <div
        class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center opacity-70"
        :class="isForgiven ? 'bg-warning/10' : 'bg-success/10'"
      >
        <UIcon
          :name="isForgiven ? 'volunteer_activism' : 'check_circle'"
          size="sm"
          :class="isForgiven ? 'text-warning' : 'text-success'"
        />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1 min-w-0">
          <p
            class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ debt.is_private ? '•••' : displayName }}
          </p>
          <UIcon
            v-if="debt.is_private"
            name="visibility_off"
            size="xs"
            class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ DEBT_DIRECTION_DISPLAY[debt.debt_type] }}
        </p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
          {{ formatMasked(debt.total_amount, debt.currency, debt.is_private) }}
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
    <template v-if="debt.closed_at">
      <div
        class="flex items-center gap-2 pt-2.5 border-t border-border-light/50 dark:border-border-dark/50"
      >
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ formatDate(debt.created_at, { format: 'short' }) }}
        </span>
        <div
          class="flex-1 h-0.5 rounded-full overflow-hidden"
          :class="isForgiven ? 'bg-warning/20' : 'bg-success/20'"
        >
          <div
            class="h-full w-full rounded-full"
            :class="isForgiven ? 'bg-warning' : 'bg-success'"
          />
        </div>
        <span
          class="text-xs font-medium shrink-0"
          :class="isForgiven ? 'text-warning' : 'text-success'"
        >
          {{ formatDate(debt.closed_at, { format: 'short' }) }}
        </span>
      </div>

      <!-- Summary line -->
      <div class="flex justify-between mt-1">
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Создан</span>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ durationDays ? `${durationDays} дн.` : '' }}
          {{ isForgiven ? ' · Прощён' : '' }}
        </span>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Закрыт</span>
      </div>
    </template>
  </button>
</template>
