<script setup lang="ts">
import { ref } from 'vue';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '../model/types';

/**
 * Выбор счёта из списка, привязанного к своему триггеру.
 *
 * Одна и та же разметка нужна и строке суммы, и панели долга — от шторки
 * `AccountPickerSheet` отличается тем, что открывается на месте, рядом с
 * маленьким инлайн-триггером, а не занимает низ экрана.
 */
defineProps<{
  accounts: AccountWithBalances[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [accountId: string];
}>();

const open = ref(false);
const { trigger } = useHaptics();

function select(id: string) {
  trigger('selection');
  emit('select', id);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="6"
      class="w-max min-w-[12rem] max-w-[min(20rem,calc(100vw-2rem))] p-1"
    >
      <button
        v-for="account in accounts"
        :key="account.id"
        type="button"
        :class="[
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
          account.id === selectedId
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-text-primary-light hover:bg-surface-light dark:text-text-primary-dark dark:hover:bg-surface-dark',
        ]"
        @click="select(account.id)"
      >
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: account.color }" />
        <span class="min-w-0 flex-1 truncate text-left">{{ account.name }}</span>
        <span
          class="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{
            formatCurrency(account.balances[0]?.balance ?? 0, account.balances[0]?.currency ?? '')
          }}
        </span>
      </button>
    </PopoverContent>
  </Popover>
</template>
