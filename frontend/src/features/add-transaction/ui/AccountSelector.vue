<script setup lang="ts">
import type { AccountWithBalances } from '@/entities/account';

defineProps<{
  accounts: AccountWithBalances[];
  selectedId: string | null;
  label: string;
  activeColor?: string;
}>();

const emit = defineEmits<{
  select: [accountId: string];
}>();
</script>

<template>
  <div class="space-y-2">
    <label
      class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        v-for="account in accounts"
        :key="account.id"
        type="button"
        :class="[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all text-sm',
          'border',
          selectedId === account.id
            ? activeColor === 'indigo'
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
              : 'border-primary bg-primary/10 text-primary'
            : 'border-gray-200 dark:border-gray-700 text-text-secondary-light dark:text-text-secondary-dark',
        ]"
        @click="emit('select', account.id)"
      >
        <span
          class="w-2.5 h-2.5 rounded-full"
          :style="{ backgroundColor: account.color }"
        />
        {{ account.name }}
        <slot name="badge" :account="account">
          <span
            v-if="account.balances.length > 1"
            class="text-xs opacity-60"
          >
            ({{ account.balances.length }})
          </span>
        </slot>
      </button>
    </div>
  </div>
</template>
