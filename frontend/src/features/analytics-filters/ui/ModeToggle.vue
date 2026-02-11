<script setup lang="ts">
import { useRouter } from 'vue-router'
import { UTabs } from '@/shared/ui'
import type { AnalyticsMode } from '../model/types'

const props = defineProps<{
  mode: AnalyticsMode
}>()

const router = useRouter()

const items = [
  { id: 'lite', label: 'Lite' },
  { id: 'full', label: 'Full' },
]

function handleChange(value: string | number) {
  if (value === 'lite') {
    router.push('/analytics')
  } else {
    router.push('/analytics/full')
  }
}
</script>

<template>
  <UTabs
    :model-value="mode"
    :items="items"
    size="sm"
    @update:model-value="handleChange"
  />
</template>
