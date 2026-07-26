<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { getInitial } from '@/shared/lib/format/text';
import { pluralize } from '@/shared/lib/format/pluralize';
import { cn } from '@/shared/lib/utils';
import type { PersonDebtSummary } from '../lib/foldGroupsIntoPeople';

const props = defineProps<{
  person: PersonDebtSummary;
  currency: string;
  selected?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

const isGiven = computed(() => props.person.direction === 'given');
const isOverdue = computed(() => props.person.overdueDays !== null);

/**
 * Мета-строка отвечает на «что с этим не так»: просрочка важнее срока, срок
 * важнее количества. Без срока — так и говорим, а не оставляем пусто.
 */
const meta = computed(() => {
  const { overdueDays, nearestDueDate, debtCount } = props.person;
  if (overdueDays !== null) {
    return `просрочено ${overdueDays} ${pluralize(overdueDays, 'день', 'дня', 'дней')}`;
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
        'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
        'hover:bg-surface-light dark:hover:bg-surface-dark',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        selected && 'bg-surface-light dark:bg-surface-dark',
      )
    "
    @click="emit('click')"
  >
    <div
      :class="
        cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-body-sm font-semibold',
          isGiven
            ? 'bg-debt-given-light text-debt-given'
            : 'bg-debt-received-light text-debt-received',
        )
      "
    >
      {{ getInitial(person.personName) }}
    </div>

    <div class="min-w-0 flex-1">
      <p
        class="flex items-center gap-1 truncate text-body font-semibold text-text-primary-light dark:text-text-primary-dark"
      >
        {{ person.personName }}
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
            'text-caption',
            isOverdue ? 'text-danger' : 'text-text-tertiary-light dark:text-text-tertiary-dark',
          )
        "
      >
        {{ meta }}
      </p>
    </div>

    <div class="shrink-0 text-right">
      <p
        :class="
          cn('text-body font-bold tabular-nums', isGiven ? 'text-debt-given' : 'text-debt-received')
        "
      >
        {{ formattedAmount }}
      </p>
      <p class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ amountLabel }}
      </p>
    </div>
  </button>
</template>
