<script setup lang="ts">
import type { ToastTitleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { ToastTitle } from 'reka-ui'
import { cn } from '@/shared/lib/utils'

const props = defineProps<ToastTitleProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <ToastTitle
    :class="cn('text-sm font-semibold', props.class)"
    v-bind="props"
  >
    <slot />
  </ToastTitle>
</template>
