<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSwipe } from '@/shared/lib/hooks/useSwipe'
import { UIcon } from '@/shared/ui'
import type { SwipeAction } from './types'

const props = withDefaults(
  defineProps<{
    /** Left swipe action (delete) - revealed when swiping left */
    leftAction?: SwipeAction
    /** Right swipe action (edit) - revealed when swiping right */
    rightAction?: SwipeAction
    /** Disable swipe functionality */
    disabled?: boolean
  }>(),
  {
    leftAction: () => ({ icon: 'delete', color: '#ef4444', label: 'Удалить' }),
    rightAction: () => ({ icon: 'edit', color: '#3b82f6', label: 'Изменить' }),
    disabled: false,
  },
)

const emit = defineEmits<{
  'action-left': []
  'action-right': []
}>()

const {
  translateX,
  isDragging,
  swipeState,
  resetSwipe,
  handlers,
} = useSwipe({
  leftEnabled: !!props.leftAction && !props.disabled,
  rightEnabled: !!props.rightAction && !props.disabled,
})

// Calculate action button opacity based on swipe distance
const leftActionOpacity = computed(() => {
  if (translateX.value >= 0) return 0
  return Math.min(Math.abs(translateX.value) / 80, 1)
})

const rightActionOpacity = computed(() => {
  if (translateX.value <= 0) return 0
  return Math.min(translateX.value / 80, 1)
})

// Handle action click when revealed
function handleLeftAction() {
  emit('action-left')
  resetSwipe()
}

function handleRightAction() {
  emit('action-right')
  resetSwipe()
}

// Touch handlers
function onTouchStart(e: TouchEvent) {
  if (props.disabled) return
  handlers.onTouchStart(e)
}

function onTouchMove(e: TouchEvent) {
  if (props.disabled) return
  handlers.onTouchMove(e)
}

function onTouchEnd() {
  if (props.disabled) return
  handlers.onTouchEnd()
}

// Expose resetSwipe for parent components
defineExpose({ resetSwipe })
</script>

<template>
  <div
    class="relative overflow-hidden"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- Right action (edit) - shown when swiping right -->
    <div
      v-if="rightAction"
      class="absolute left-0 top-0 bottom-0 w-20 flex items-center justify-center"
      :style="{
        backgroundColor: rightAction.color,
        opacity: rightActionOpacity,
      }"
      @click="handleRightAction"
    >
      <div class="flex flex-col items-center gap-0.5 text-white">
        <UIcon :name="rightAction.icon" size="md" />
        <span v-if="rightAction.label" class="text-xs font-medium">
          {{ rightAction.label }}
        </span>
      </div>
    </div>

    <!-- Left action (delete) - shown when swiping left -->
    <div
      v-if="leftAction"
      class="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center"
      :style="{
        backgroundColor: leftAction.color,
        opacity: leftActionOpacity,
      }"
      @click="handleLeftAction"
    >
      <div class="flex flex-col items-center gap-0.5 text-white">
        <UIcon :name="leftAction.icon" size="md" />
        <span v-if="leftAction.label" class="text-xs font-medium">
          {{ leftAction.label }}
        </span>
      </div>
    </div>

    <!-- Main content -->
    <div
      class="relative bg-card-light dark:bg-card-dark transition-shadow duration-200"
      :class="isDragging && 'shadow-lg'"
      :style="{
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      }"
      role="group"
      :aria-label="isDragging ? 'Смахните для действия' : undefined"
    >
      <slot />
    </div>
  </div>
</template>
