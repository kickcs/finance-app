<script setup lang="ts">
import { computed } from 'vue';
import { UBadge } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { isPastDate } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';
import { DEBT_DIRECTION_LABELS, getDebtSplit } from '../model/types';
import type { Debt } from '../model/types';
import DebtProgressMeter from './DebtProgressMeter.vue';

const props = defineProps<{ debt: Debt }>();

const isGiven = computed(() => props.debt.debt_type === 'given');

const isOverdue = computed(
  () =>
    !props.debt.is_closed &&
    !!props.debt.next_payment_date &&
    isPastDate(props.debt.next_payment_date),
);

// У закрытого долга остаток нулевой, поэтому под подписью «Сумма долга»
// показываем исходную сумму — иначе на странице был бы только ноль.
const heroAmount = computed(() =>
  props.debt.is_closed ? props.debt.total_amount : props.debt.remaining_amount,
);

const split = computed(() => getDebtSplit(props.debt));
const paid = computed(() => split.value.paid);
const forgiven = computed(() => split.value.forgiven);
/**
 * У полностью выплаченного закрытого долга полоса была бы сплошной, а её
 * подпись — повтором суммы из заголовка. Показываем её там, где она добавляет
 * знание: в открытом долге (сколько уже отдано) и когда часть суммы прощена.
 */
const showMeter = computed(() => forgiven.value > 0 || (!props.debt.is_closed && paid.value > 0));

const fee = computed(() => props.debt.fee_amount ?? 0);
const hasFee = computed(() => fee.value > 0);
const totalCost = computed(() => props.debt.total_amount + fee.value);

function money(amount: number): string {
  return formatMasked(amount, props.debt.currency, props.debt.is_private);
}
</script>

<template>
  <div
    data-testid="debt-hero"
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-5"
  >
    <div class="flex items-center justify-between gap-3">
      <!-- Направление несёт идентичность долга вместо аватара и дубля имени: имя уже в шапке страницы -->
      <span
        :class="
          cn(
            'text-caption-sm font-semibold uppercase tracking-wider',
            isGiven ? 'text-debt-given' : 'text-debt-received',
          )
        "
      >
        {{ DEBT_DIRECTION_LABELS[debt.debt_type] }}
      </span>

      <UBadge v-if="debt.is_closed" variant="success" shape="pill">Погашен</UBadge>
      <UBadge v-else-if="isOverdue" variant="danger" shape="pill">Просрочено</UBadge>
    </div>

    <div class="mt-4">
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

    <DebtProgressMeter
      v-if="showMeter"
      class="mt-4"
      :total="debt.total_amount"
      :paid="paid"
      :forgiven="forgiven"
      :currency="debt.currency"
      :hidden="debt.is_private"
      size="md"
    />

    <!-- Одна строка вместо трёх старых («Комиссия» / «Обошёлся в» отдельными рядами) -->
    <p
      v-if="hasFee"
      data-testid="debt-fee-row"
      class="mt-3 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Комиссия {{ money(fee) }} · обошёлся в {{ money(totalCost) }}
    </p>
  </div>
</template>
