<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { periodLabel } from '../lib/historyPeriod';
import { FACETS, type FacetName, type FacetValues } from '../model/facets';

const props = defineProps<{
  values: FacetValues;
  /** У переводов нет категорий — чип там не нужен. */
  hideCategory?: boolean;
}>();

const emit = defineEmits<{
  open: [facet: FacetName];
  clear: [facet: FacetName];
}>();

const { userId } = useCurrentUser();
const { getCategoryById } = useCategories(userId);
const { accounts } = useAccounts(userId);

/** «Такси», «Такси +2»; если названия не нашлось (удалённая категория), честно считаем выбранное. */
function setLabel(ids: string[], nameOf: (id: string) => string | undefined): string | null {
  if (ids.length === 0) return null;
  const first = nameOf(ids[0]);
  if (!first) return `${ids.length} выбрано`;
  return ids.length > 1 ? `${first} +${ids.length - 1}` : first;
}

interface Chip {
  facet: FacetName;
  title: string;
  /** Подпись выбранного значения; `null` — чип не активен. */
  value: string | null;
}

const valueLabel: Record<FacetName, (values: FacetValues) => string | null> = {
  period: (v) => periodLabel(v.period) || null,
  category: (v) => setLabel(v.categoryIds, (id) => getCategoryById(id)?.name),
  tag: (v) => setLabel(v.tags, (tag) => `#${tag}`),
  account: (v) => setLabel(v.accountIds, (id) => accounts.value.find((a) => a.id === id)?.name),
};

const chips = computed<Chip[]>(() =>
  (Object.keys(FACETS) as FacetName[])
    .filter((facet) => !(facet === 'category' && props.hideCategory))
    .map((facet) => ({
      facet,
      title: FACETS[facet].title,
      value: valueLabel[facet](props.values),
    })),
);
</script>

<template>
  <!-- Горизонтальный скролл вместо переноса: четыре чипа с выбранными значениями в ряд не влезают -->
  <div
    data-testid="history-facet-rail"
    class="shrink-0 flex gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5"
  >
    <span
      v-for="chip in chips"
      :key="chip.facet"
      :class="
        cn(
          'inline-flex h-[34px] shrink-0 items-center rounded-full border',
          chip.value
            ? 'border-text-primary-light bg-text-primary-light text-text-primary-dark dark:border-text-primary-dark dark:bg-text-primary-dark dark:text-text-primary-light'
            : 'border-border-light bg-card-light text-text-primary-light dark:border-border-dark dark:bg-card-dark dark:text-text-primary-dark',
        )
      "
    >
      <button
        type="button"
        aria-haspopup="dialog"
        :data-testid="`facet-chip-${chip.facet}`"
        :class="
          cn(
            'inline-flex h-full max-w-[200px] items-center gap-1.5 rounded-full pl-3 text-body-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            chip.value ? 'pr-1' : 'pr-2.5',
          )
        "
        @click="emit('open', chip.facet)"
      >
        <UIcon v-if="chip.facet === 'period'" name="calendar_month" size="sm" />
        <span class="truncate">{{ chip.value ?? chip.title }}</span>
        <UIcon v-if="!chip.value" name="expand_more" size="sm" />
      </button>
      <button
        v-if="chip.value"
        type="button"
        :aria-label="`Сбросить: ${chip.title}`"
        :data-testid="`facet-clear-${chip.facet}`"
        class="mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-primary-dark/70 transition-colors hover:text-text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-primary-light/70 dark:hover:text-text-primary-light"
        @click="emit('clear', chip.facet)"
      >
        <UIcon name="close" size="xs" />
      </button>
    </span>
  </div>
</template>
