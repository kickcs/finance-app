<script setup lang="ts">
import { UOverlay } from '@/shared/ui/overlay';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '../model/types';

withDefaults(
  defineProps<{
    open: boolean;
    accounts: AccountWithBalances[];
    selectedId: string | null;
    title?: string;
  }>(),
  { title: 'Выберите счёт' },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [accountId: string];
}>();

function pick(accountId: string) {
  emit('select', accountId);
  emit('update:open', false);
}
</script>

<template>
  <UOverlay
    :model-value="open"
    :title="title"
    desktop="dialog"
    @update:model-value="emit('update:open', $event)"
  >
    <p
      v-if="accounts.length === 0"
      class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Нет доступных счетов
    </p>
    <button
      v-for="account in accounts"
      :key="account.id"
      type="button"
      class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
      :class="
        account.id === selectedId
          ? 'bg-primary/10'
          : 'hover:bg-surface-light dark:hover:bg-surface-dark'
      "
      @click="pick(account.id)"
    >
      <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: account.color }" />
      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-medium truncate"
          :class="
            account.id === selectedId
              ? 'text-primary'
              : 'text-text-primary-light dark:text-text-primary-dark'
          "
        >
          {{ account.name }}
        </p>
      </div>
      <span class="text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ formatCurrency(account.balances[0]?.balance ?? 0, account.balances[0]?.currency ?? '') }}
        <template v-if="account.balances.length > 1">+{{ account.balances.length - 1 }}</template>
      </span>
    </button>
  </UOverlay>
</template>
