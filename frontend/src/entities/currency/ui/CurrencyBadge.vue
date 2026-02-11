<script setup lang="ts">
import { getCurrencyByCode } from '../model/constants'

const props = defineProps<{
  code: string
  showName?: boolean
}>()

const currency = getCurrencyByCode(props.code)
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-lg">{{ currency?.flag ?? '🌐' }}</span>
    <span class="font-semibold text-text-primary-light dark:text-text-primary-dark">
      {{ code }}
    </span>
    <span
      v-if="showName && currency"
      class="text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ currency.name }}
    </span>
  </div>
</template>
