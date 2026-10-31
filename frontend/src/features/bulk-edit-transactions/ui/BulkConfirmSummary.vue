<script setup lang="ts">
import { computed } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import type { BulkAction } from '@/entities/transaction';
import { formatCurrency } from '@/shared/lib/format/currency';
import { IconBadge, Skeleton, UIcon } from '@/shared/ui';
import { actionTexts, opsCount, skipReasonText } from '../model/bulkTexts';
import type { BulkPreview } from '../model/useBulkEditFlow';

const props = defineProps<{
  action: BulkAction;
  targetName?: string;
  preview: BulkPreview;
  categories: Category[];
  accounts: AccountWithBalances[];
  /** Все операции из одной категории: перенос показывается «из неё → в цель». */
  sourceCategoryId?: string;
}>();

const result = computed(() => (props.preview.status === 'ready' ? props.preview.result : null));
const isPending = computed(
  () => props.preview.status === 'idle' || props.preview.status === 'loading',
);

const sourceCategory = computed(() =>
  props.action.kind === 'category' && props.sourceCategoryId
    ? props.categories.find((c) => c.id === props.sourceCategoryId)
    : undefined,
);

/** Куда уходят операции: плитка справа в блоке «было → стало». Для тега и удаления цели нет. */
const target = computed(() => {
  const { action, targetName } = props;
  if (action.kind === 'category') {
    const category = props.categories.find((c) => c.id === action.category_id);
    return {
      leftIcon: 'category',
      icon: category?.icon ?? 'category',
      color: category?.color,
      name: targetName ?? category?.name ?? '',
    };
  }
  if (action.kind === 'transfer' || action.kind === 'account') {
    const id = action.kind === 'transfer' ? action.to_account_id : action.account_id;
    const account = props.accounts.find((a) => a.id === id);
    return {
      leftIcon: 'account_balance_wallet',
      icon: account?.icon ?? 'account_balance_wallet',
      color: account?.color,
      name: targetName ?? account?.name ?? '',
    };
  }
  return null;
});

const balanceRows = computed(() =>
  (result.value?.balance_deltas ?? []).map((d) => {
    const account = props.accounts.find((a) => a.id === d.account_id);
    // Нет строки в этой валюте — считаем от нуля.
    const before = account?.balances.find((b) => b.currency === d.currency)?.balance ?? 0;
    const format = (value: number) => formatCurrency(value, d.currency, { showSymbol: false });
    return {
      key: `${d.account_id}:${d.currency}`,
      label: `${account?.name ?? 'Счёт'} (${d.currency})`,
      value: `${format(before)} → ${format(before + d.delta)}`,
    };
  }),
);

const note = computed(
  () => actionTexts(props.action, result.value?.changed ?? 0, target.value?.name).note,
);

const ROW_CLASS =
  'flex justify-between gap-3 py-2.5 border-b border-border-light dark:border-border-dark text-body-sm';
</script>

<template>
  <div v-if="isPending" class="space-y-3" aria-busy="true" data-testid="bulk-confirm-skeleton">
    <Skeleton v-if="target" class="h-24 rounded-2xl" />
    <Skeleton v-for="i in 3" :key="i" class="h-5" />
  </div>

  <div
    v-else-if="preview.status === 'error'"
    role="alert"
    class="flex items-start gap-2 rounded-xl bg-warning-light p-3 text-body-sm text-warning"
  >
    <UIcon name="warning" size="sm" class="mt-0.5" />
    <span>{{ preview.message }}</span>
  </div>

  <div v-else-if="result">
    <p
      v-if="result.changed === 0"
      class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark"
    >
      Ни одна из операций не подходит для этого действия.
    </p>

    <template v-else>
      <div
        v-if="target"
        class="mb-2 flex items-center gap-2 rounded-2xl bg-background-light dark:bg-background-dark px-2.5 py-4"
        data-testid="bulk-confirm-flow"
      >
        <div
          class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center text-body-sm font-semibold"
        >
          <template v-if="sourceCategory">
            <IconBadge :icon="sourceCategory.icon" :color="sourceCategory.color" size="lg" />
            <span class="max-w-full truncate">{{ sourceCategory.name }}</span>
          </template>
          <template v-else>
            <IconBadge
              :icon="target.leftIcon"
              bg-class="bg-surface-light dark:bg-surface-dark"
              size="lg"
            />
            <span>{{ opsCount(result.changed) }}</span>
          </template>
        </div>
        <UIcon
          name="arrow_forward"
          size="lg"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <div
          class="flex min-w-0 flex-1 flex-col items-center gap-2 text-center text-body-sm font-semibold"
        >
          <IconBadge :icon="target.icon" :color="target.color" size="lg" />
          <span class="max-w-full truncate">{{ target.name }}</span>
        </div>
      </div>

      <div :class="ROW_CLASS">
        <span class="text-text-secondary-light dark:text-text-secondary-dark">Операций</span>
        <span class="font-semibold tabular-nums">{{ result.changed }}</span>
      </div>
      <div v-for="row in balanceRows" :key="row.key" :class="ROW_CLASS">
        <span class="text-text-secondary-light dark:text-text-secondary-dark">{{ row.label }}</span>
        <span class="text-right font-semibold tabular-nums">{{ row.value }}</span>
      </div>

      <p
        class="mt-3 text-body-sm leading-snug text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ note }}
      </p>
    </template>

    <p
      v-for="skip in result.skipped"
      :key="skip.reason"
      class="mt-3 flex items-start gap-2 text-body-sm leading-snug text-warning"
      data-testid="bulk-confirm-skip"
    >
      <UIcon name="warning" size="sm" class="mt-0.5" />
      <span>{{ skipReasonText(skip.reason, skip.count, action.kind) }}</span>
    </p>
  </div>
</template>
