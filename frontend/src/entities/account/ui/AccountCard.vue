<script setup lang="ts">
import { computed } from 'vue'
import { UIcon } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import { getCurrencyByCode } from '@/entities/currency'
import type { AccountWithBalances } from '../model/types'

const props = defineProps<{
  account: AccountWithBalances
  showBalance?: boolean
  compact?: boolean
}>()

defineEmits<{
  click: []
}>()

// Format balances for display
const formattedBalances = computed(() => {
  if (!props.account.balances || props.account.balances.length === 0) {
    return '0'
  }

  // Show up to 3 balances compactly
  const balances = props.account.balances.slice(0, 3)
  return balances
    .map((b) => formatCurrency(b.balance, b.currency, { compact: true }))
    .join(' · ')
})

// Check if there are more balances than shown
const hasMoreBalances = computed(() => props.account.balances.length > 3)
</script>

<template>
  <button
    :class="[
      'w-full flex items-center gap-3 rounded-xl transition-all duration-150',
      'bg-card-light dark:bg-card-dark',
      'border border-border-light dark:border-border-dark',
      'hover:bg-surface-light dark:hover:bg-surface-dark',
      'active:opacity-80',
      compact ? 'p-3' : 'p-4',
    ]"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div
      class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
      :style="{
        backgroundColor: `${account.color}12`,
      }"
    >
      <UIcon
        :name="account.icon"
        size="md"
        :style="{ color: account.color }"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 text-left min-w-0">
      <div class="flex items-center gap-1.5">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ account.name }}
        </p>
        <span
          v-if="account.balances.length > 1"
          class="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ account.balances.length }}
        </span>
      </div>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ account.type === 'basic' ? 'Основной' : 'Накопительный' }}
      </p>
    </div>

    <!-- Balance -->
    <div
      v-if="showBalance !== false"
      class="text-right shrink-0 min-w-0 max-w-[45%]"
    >
      <!-- Multi-currency -->
      <div v-if="account.balances.length > 1" class="space-y-0.5">
        <div
          v-for="balance in account.balances.slice(0, 2)"
          :key="balance.currency"
          class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark whitespace-nowrap"
        >
          {{ getCurrencyByCode(balance.currency)?.flag }}
          {{ formatCurrency(balance.balance, balance.currency, { compact: true }) }}
        </div>
        <p
          v-if="account.balances.length > 2"
          class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          +{{ account.balances.length - 2 }} ещё
        </p>
      </div>

      <!-- Single currency -->
      <p
        v-else
        class="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark truncate"
      >
        {{ formattedBalances }}
      </p>
    </div>

    <!-- Arrow -->
    <UIcon
      name="chevron_right"
      size="xs"
      class="text-text-tertiary-light dark:text-text-tertiary-dark"
    />
  </button>
</template>
