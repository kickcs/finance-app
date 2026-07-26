<script setup lang="ts">
import { computed } from 'vue';
import { UCard } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import type { Debt } from '../model/types';

const props = defineProps<{ debt: Debt }>();

const fee = computed(() => props.debt.fee_amount ?? 0);
const hasFee = computed(() => fee.value > 0);
const totalCost = computed(() => props.debt.total_amount + fee.value);
const paid = computed(() => props.debt.total_amount - props.debt.remaining_amount);
// У закрытого долга погашено ровно столько же, сколько взято — строка была бы
// дублем суммы долга.
const isPartiallyPaid = computed(() => paid.value > 0 && !props.debt.is_closed);

/**
 * Нетронутый долг без комиссии раскладывать не на что: сумма, остаток и число
 * в шапке — одно и то же, и блок превращается в тройной повтор.
 */
const hasSomethingToBreakDown = computed(() => hasFee.value || isPartiallyPaid.value);

function money(amount: number): string {
  return formatMasked(amount, props.debt.currency, props.debt.is_private);
}
</script>

<template>
  <UCard
    v-if="hasSomethingToBreakDown"
    data-testid="debt-breakdown"
    variant="bordered"
    class="p-5 space-y-3"
  >
    <div class="flex items-center justify-between gap-4">
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Сумма долга
      </span>
      <span
        class="text-body-sm font-medium tabular-nums text-text-primary-light dark:text-text-primary-dark"
      >
        {{ money(debt.total_amount) }}
      </span>
    </div>

    <div v-if="hasFee" data-testid="debt-fee-row" class="flex items-center justify-between gap-4">
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Комиссия за перевод
      </span>
      <span class="text-body-sm font-medium tabular-nums text-danger">
        {{ money(fee) }}
      </span>
    </div>

    <div
      v-if="hasFee"
      class="flex items-center justify-between gap-4 border-t border-border-light dark:border-border-dark pt-3"
    >
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Обошёлся в
      </span>
      <span
        class="text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
      >
        {{ money(totalCost) }}
      </span>
    </div>

    <div v-if="isPartiallyPaid" class="flex items-center justify-between gap-4">
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Погашено
      </span>
      <span class="text-body-sm font-medium tabular-nums text-success">
        {{ money(paid) }}
      </span>
    </div>

    <div v-if="!debt.is_closed" class="flex items-center justify-between gap-4">
      <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        Осталось
      </span>
      <span
        class="text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
      >
        {{ money(debt.remaining_amount) }}
      </span>
    </div>
  </UCard>
</template>
