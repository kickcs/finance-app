<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { UTabs } from '@/shared/ui';
import type { AnalyticsMode } from '../model/types';

defineProps<{
  mode: AnalyticsMode;
}>();

const router = useRouter();

const items = [
  { id: 'lite', label: 'Lite' },
  { id: 'full', label: 'Full' },
];

function handleChange(value: string | number) {
  if (value === 'lite') {
    router.push({ name: ROUTE_NAMES.ANALYTICS });
  } else {
    router.push({ name: ROUTE_NAMES.ANALYTICS_FULL });
  }
}
</script>

<template>
  <UTabs :model-value="mode" :items="items" size="sm" @update:model-value="handleChange" />
</template>
