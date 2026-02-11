<script setup lang="ts">
import { UInput } from '@/shared/ui'
import { CurrencyItem, useCurrencySelection } from '@/features/select-currency'
import type { Currency } from '@/entities/currency'

defineProps<{
  selectedCode?: string
}>()

const emit = defineEmits<{
  select: [currency: Currency]
}>()

const { searchQuery, filteredCurrencies, setSearchQuery } = useCurrencySelection()
</script>

<template>
  <div class="space-y-4">
    <!-- Search -->
    <UInput
      :model-value="searchQuery"
      variant="search"
      placeholder="Поиск валюты..."
      @update:model-value="setSearchQuery($event as string)"
    />

    <!-- Currency List -->
    <div class="space-y-2">
      <CurrencyItem
        v-for="currency in filteredCurrencies"
        :key="currency.code"
        :currency="currency"
        :selected="selectedCode === currency.code"
        @select="$emit('select', currency)"
      />
    </div>

    <!-- Empty state -->
    <div
      v-if="filteredCurrencies.length === 0"
      class="py-8 text-center text-text-secondary-light dark:text-text-secondary-dark"
    >
      Валюта не найдена
    </div>
  </div>
</template>
