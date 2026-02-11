<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'
import { TooltipContent, TooltipPortal } from 'reka-ui'
import { cn } from '@/shared/lib/utils'
import { computed, type HTMLAttributes } from 'vue'

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    sideOffset: 4,
  }
)

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="delegatedProps"
      :class="
        cn(
          'z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-xs text-gray-50 dark:text-gray-900 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
