<script setup lang="ts">
import { computed } from 'vue';
import { UBadge, UButton, UIcon } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import { DEBT_DIRECTION_COLORS } from '../model/types';
import type { MutualPosition } from '../lib/foldDebtsIntoPeople';

const props = defineProps<{
  position: MutualPosition;
  /** Суммы скрыты, если хоть один долг человека приватный. */
  masked?: boolean;
  /** Показывать валюту в шапке — когда встречных валют больше одной. */
  showCurrency?: boolean;
  isOffsetting?: boolean;
}>();

const emit = defineEmits<{ offset: [] }>();

const { trigger } = useHaptics();

function handleOffset() {
  trigger('selection');
  emit('offset');
}

const total = computed(() => props.position.given + props.position.taken);

/**
 * Полоса читается слева направо: то, что должны вам, встречается с тем, что
 * должны вы. Совпавшие куски равны по ширине и приглушены — это и есть зачёт;
 * в полном цвете остаётся только то, что переживёт его.
 */
const segments = computed(() => {
  const { given: g, taken: t, offsetAmount: o } = props.position;
  const width = (value: number) => (total.value > 0 ? (value / total.value) * 100 : 0);
  return [
    { key: 'given-solid', color: DEBT_DIRECTION_COLORS.given, width: width(g - o), dim: false },
    { key: 'given-offset', color: DEBT_DIRECTION_COLORS.given, width: width(o), dim: true },
    { key: 'taken-offset', color: DEBT_DIRECTION_COLORS.taken, width: width(o), dim: true },
    { key: 'taken-solid', color: DEBT_DIRECTION_COLORS.taken, width: width(t - o), dim: false },
  ].filter((segment) => segment.width > 0);
});

const rest = computed(() => {
  const net = props.position.given - props.position.taken;
  return {
    direction: net >= 0 ? ('given' as const) : ('taken' as const),
    amount: Math.abs(net),
  };
});

const money = (amount: number) => formatMasked(amount, props.position.currency, props.masked);
</script>

<template>
  <section
    data-testid="mutual-debt-card"
    class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-5"
  >
    <header class="flex items-center justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <UIcon name="compare_arrows" size="xs" />
        Встречные долги
      </p>
      <UBadge v-if="showCurrency" variant="neutral" size="sm" shape="pill">
        {{ position.currency }}
      </UBadge>
    </header>

    <div class="mt-3 flex items-start justify-between gap-4">
      <div>
        <p class="text-body font-bold tabular-nums text-debt-given">{{ money(position.given) }}</p>
        <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">вам должны</p>
      </div>
      <div class="text-right">
        <p class="text-body font-bold tabular-nums text-debt-received">
          {{ money(position.taken) }}
        </p>
        <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">вы должны</p>
      </div>
    </div>

    <div class="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
      <div
        v-for="segment in segments"
        :key="segment.key"
        :class="cn('h-full', segment.dim && 'opacity-40')"
        :style="{ width: `${segment.width}%`, backgroundColor: segment.color }"
      />
    </div>

    <p class="mt-3 text-caption text-text-secondary-light dark:text-text-secondary-dark">
      Зачёт спишет по {{ money(position.offsetAmount) }} с каждой стороны.
    </p>

    <p class="mt-2 text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark">
      Останется
      <span
        :class="
          cn(
            'font-bold tabular-nums',
            rest.direction === 'given' ? 'text-debt-given' : 'text-debt-received',
          )
        "
      >
        {{ rest.direction === 'given' ? 'вам должны' : 'вы должны' }} {{ money(rest.amount) }}
      </span>
    </p>

    <UButton
      class="mt-4"
      full-width
      data-testid="offset-debts-btn"
      :loading="isOffsetting"
      @click="handleOffset"
    >
      <UIcon name="compare_arrows" size="sm" />
      Зачесть
    </UButton>
  </section>
</template>
