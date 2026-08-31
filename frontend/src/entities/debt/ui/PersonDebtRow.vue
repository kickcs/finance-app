<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency, formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { getInitial } from '@/shared/lib/format/text';
import { pluralize } from '@/shared/lib/format/pluralize';
import { cn } from '@/shared/lib/utils';
import type { PersonDebtSummary } from '../lib/foldDebtsIntoPeople';

const props = defineProps<{
  person: PersonDebtSummary;
  currency: string;
  selected?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

const isGiven = computed(() => props.person.direction === 'given');
const isOverdue = computed(() => props.person.overdueDays !== null);
const isMutual = computed(() => props.person.mutual.length > 0);

/**
 * Мета-строка отвечает на «что с этим не так»: просрочка важнее срока, срок
 * важнее количества. Без срока — так и говорим, а не оставляем пусто.
 */
const meta = computed(() => {
  const { overdueDays, nearestDueDate, debtCount } = props.person;
  if (overdueDays !== null) {
    return `просрочено ${overdueDays} ${pluralize(overdueDays, 'день', 'дня', 'дней')}`;
  }
  if (isMutual.value) {
    return props.person.hasPrivate
      ? 'можно зачесть'
      : `зачёт ${formatCurrency(props.person.offsetTotal, props.currency, COMPACT_FORMAT)}`;
  }
  if (nearestDueDate) return `до ${formatDate(nearestDueDate, { format: 'short' })}`;
  if (debtCount > 1) return `${debtCount} ${pluralize(debtCount, 'долг', 'долга', 'долгов')}`;
  return 'без срока';
});

const amountLabel = computed(() => (isGiven.value ? 'должен вам' : 'вы должны'));

const formattedAmount = computed(() =>
  formatMasked(Math.abs(props.person.net), props.currency, props.person.hasPrivate),
);

const ariaLabel = computed(() =>
  props.person.hasPrivate
    ? `${props.person.personName}, ${amountLabel.value}, сумма скрыта`
    : `${props.person.personName}, ${amountLabel.value} ${formattedAmount.value}`,
);
</script>

<template>
  <button
    type="button"
    data-testid="person-debt-row"
    :aria-label="ariaLabel"
    :class="
      cn(
        'flex w-full items-center gap-3 py-3.5 pl-4 pr-3 text-left transition-colors',
        'hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        selected && 'bg-surface-light dark:bg-surface-dark',
      )
    "
    @click="emit('click')"
  >
    <!-- Двуцветный кружок у встречных долгов: направление одним цветом
         обозначить нельзя — человек одновременно и должник, и кредитор. -->
    <div
      :class="
        cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-body-sm font-semibold',
          isGiven ? 'text-debt-given' : 'text-debt-received',
          !isMutual && (isGiven ? 'bg-debt-given-light' : 'bg-debt-received-light'),
        )
      "
      :style="
        isMutual
          ? {
              background:
                'linear-gradient(135deg, var(--color-debt-given-light) 50%, var(--color-debt-received-light) 50%)',
            }
          : undefined
      "
    >
      {{ getInitial(person.personName) }}
    </div>

    <!-- Сумма стоит в одной строке с именем, а мета-строка занимает всю ширину
         под ними. Прошлая вёрстка держала сумму отдельной правой колонкой, и
         на длинных значениях («1 200 000 UZS») мете оставалось столько места,
         что от неё было видно один символ и многоточие. -->
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <p
          class="flex min-w-0 items-center gap-1 text-body font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          <span class="truncate">{{ person.personName }}</span>
          <UIcon
            v-if="person.hasPrivate"
            name="visibility_off"
            size="xs"
            class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </p>
        <p
          :class="
            cn(
              'ml-auto shrink-0 text-body font-bold tabular-nums',
              isGiven ? 'text-debt-given' : 'text-debt-received',
            )
          "
        >
          {{ formattedAmount }}
        </p>
      </div>

      <p class="mt-0.5 flex min-w-0 items-center gap-1 text-caption">
        <span :class="cn('shrink-0', isGiven ? 'text-debt-given' : 'text-debt-received')">
          {{ amountLabel }}
        </span>
        <span class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark">·</span>
        <UIcon
          v-if="!isOverdue && isMutual"
          name="compare_arrows"
          size="xs"
          class="shrink-0 text-primary"
        />
        <span
          :class="
            cn(
              'truncate',
              isOverdue && 'text-danger',
              !isOverdue && isMutual && 'text-primary',
              !isOverdue && !isMutual && 'text-text-tertiary-light dark:text-text-tertiary-dark',
            )
          "
        >
          {{ meta }}
        </span>
      </p>
    </div>

    <UIcon
      name="chevron_right"
      size="sm"
      class="-mr-1 shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
    />
  </button>
</template>
