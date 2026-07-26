<script setup lang="ts">
import { computed } from 'vue';
import { UBadge, UProgressBar } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { getInitial } from '@/shared/lib/format/text';
import { isPastDate } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';
import {
  DEBT_DIRECTION_LABELS,
  DEBT_DIRECTION_COLORS,
  getDebtDisplayName,
  getDebtProgress,
} from '../model/types';
import type { Debt } from '../model/types';

const props = defineProps<{ debt: Debt }>();

const isGiven = computed(() => props.debt.debt_type === 'given');
const displayName = computed(() => getDebtDisplayName(props.debt));
const progress = computed(() => getDebtProgress(props.debt));

const isOverdue = computed(
  () =>
    !props.debt.is_closed &&
    !!props.debt.next_payment_date &&
    isPastDate(props.debt.next_payment_date),
);

const isPartiallyPaid = computed(
  () => !props.debt.is_closed && props.debt.remaining_amount < props.debt.total_amount,
);

// У закрытого долга остаток нулевой, поэтому под подписью «Сумма долга»
// показываем исходную сумму — иначе на странице был бы только ноль.
const heroAmount = computed(() =>
  props.debt.is_closed ? props.debt.total_amount : props.debt.remaining_amount,
);
</script>

<template>
  <div
    data-testid="debt-hero"
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-5"
  >
    <div class="flex items-start gap-4">
      <div
        :class="
          cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-h3 font-bold',
            isGiven
              ? 'bg-debt-given-light text-debt-given'
              : 'bg-debt-received-light text-debt-received',
          )
        "
      >
        {{ debt.is_private ? '•' : getInitial(displayName) }}
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-h3 font-bold text-text-primary-light dark:text-text-primary-dark">
          {{ debt.is_private ? '•••' : displayName }}
        </p>
        <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ DEBT_DIRECTION_LABELS[debt.debt_type] }}
        </p>
      </div>

      <UBadge v-if="debt.is_closed" variant="success" shape="pill">Погашен</UBadge>
      <UBadge v-else-if="isOverdue" variant="danger" shape="pill">Просрочено</UBadge>
    </div>

    <div class="mt-5">
      <p
        class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        {{ debt.is_closed ? 'Сумма долга' : 'Осталось вернуть' }}
      </p>
      <p
        data-testid="debt-hero-amount"
        class="mt-1 text-display font-bold tracking-tight tabular-nums text-text-primary-light dark:text-text-primary-dark"
      >
        {{ formatMasked(heroAmount, debt.currency, debt.is_private) }}
      </p>
    </div>

    <div v-if="isPartiallyPaid" class="mt-4 space-y-1.5">
      <UProgressBar :value="progress" :color="DEBT_DIRECTION_COLORS[debt.debt_type]" />
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
        Погашено {{ progress }}% из
        {{ formatMasked(debt.total_amount, debt.currency, debt.is_private) }}
      </p>
    </div>
  </div>
</template>
