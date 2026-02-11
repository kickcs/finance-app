<script setup lang="ts">
import { UIcon } from '@/shared/ui'

defineProps<{
  label?: string
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="w-full py-2.5 text-sm font-medium text-primary
           hover:bg-primary-light active:opacity-80
           rounded-lg transition-all duration-150
           flex items-center justify-center gap-0.5"
    @click="$emit('click')"
  >
    <slot>{{ label || 'Показать все' }}</slot>
    <UIcon name="chevron_right" size="xs" />
  </button>
</template>
