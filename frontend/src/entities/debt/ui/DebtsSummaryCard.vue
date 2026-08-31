<script setup lang="ts">
import { computed } from 'vue';
import { UProgressBar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';

const props = withDefaults(
  defineProps<{
    totalGiven: number;
    totalTaken: number;
    currency: string;
    title?: string;
  }>(),
  { title: 'Итог по всем' },
);

const net = computed(() => props.totalGiven - props.totalTaken);
const isPositive = computed(() => net.value >= 0);
const total = computed(() => props.totalGiven + props.totalTaken);

/**
 * Полоса показывает, как долги разошлись по чашам, и потому имеет смысл только
 * когда обе чаши непустые. При одностороннем итоге она вырождается в сплошную
 * заливку во всю ширину — та ничего не сообщает, поэтому её просто нет.
 */
const isSplit = computed(() => props.totalGiven > 0 && props.totalTaken > 0);
const givenShare = computed(() => (total.value > 0 ? (props.totalGiven / total.value) * 100 : 0));

/** Знак и цвет читаются не всеми; направление итога проговариваем словами. */
const netCaption = computed(() => {
  if (net.value === 0) return total.value > 0 ? 'долги сходятся' : 'долгов нет';
  return isPositive.value ? 'в вашу пользу' : 'не в вашу пользу';
});
</script>

<template>
  <div
    data-testid="debts-summary"
    class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-5"
  >
    <p
      class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      {{ title }}
    </p>

    <!-- Крупные суммы не режем многоточием: перенос по словам оставляет их
         читаемыми целиком, tabular-nums не даёт цифрам прыгать при пересчёте. -->
    <p
      data-testid="debts-summary-net"
      class="mt-1 text-h1 font-bold tracking-tight tabular-nums leading-snug break-words"
      :class="isPositive ? 'text-debt-given' : 'text-debt-received'"
    >
      {{ isPositive ? '+' : '−' }}{{ formatCurrency(Math.abs(net), currency) }}
    </p>

    <p class="mt-0.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
      {{ netCaption }}
    </p>

    <!-- Одна дорожка вместо двух сегментов с зазором: доля задаётся шириной
         заливки, поэтому на крайних значениях не остаётся паразитной щели. -->
    <UProgressBar
      v-if="isSplit"
      class="mt-4"
      :value="givenShare"
      color="var(--color-debt-given)"
      track-color="var(--color-debt-received)"
      size="sm"
      aria-hidden="true"
    />

    <div
      class="mt-4 grid grid-cols-2 divide-x divide-border-light dark:divide-border-dark"
      :class="!isSplit && 'border-t border-border-light dark:border-border-dark pt-4'"
    >
      <div class="min-w-0 pr-4">
        <p
          class="flex items-center gap-1.5 text-caption text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-debt-given" />
          Вам должны
        </p>
        <p
          class="mt-0.5 text-body-sm font-semibold tabular-nums break-words"
          :class="
            totalGiven > 0
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ formatCurrency(totalGiven, currency) }}
        </p>
      </div>

      <div class="min-w-0 pl-4">
        <p
          class="flex items-center gap-1.5 text-caption text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-debt-received" />
          Вы должны
        </p>
        <p
          class="mt-0.5 text-body-sm font-semibold tabular-nums break-words"
          :class="
            totalTaken > 0
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ formatCurrency(totalTaken, currency) }}
        </p>
      </div>
    </div>
  </div>
</template>
