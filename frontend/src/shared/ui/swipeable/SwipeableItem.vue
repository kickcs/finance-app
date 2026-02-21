<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useSwipe } from '@/shared/lib/hooks/useSwipe';
import { useLocalStorage } from '@/shared/lib/hooks/useLocalStorage';
import { UIcon } from '@/shared/ui/icon';
import { UBadge } from '@/shared/ui/badge';
import type { SwipeAction } from './types';

const props = withDefaults(
  defineProps<{
    /** Left swipe action (delete) - revealed when swiping left */
    leftAction?: SwipeAction;
    /** Right swipe action (edit) - revealed when swiping right */
    rightAction?: SwipeAction;
    /** Disable swipe functionality */
    disabled?: boolean;
    /** Whether to play a "peek" animation on mount to teach the user they can swipe */
    autoPeek?: boolean;
  }>(),
  {
    leftAction: () => ({ icon: 'delete', color: '#ef4444', label: 'Удалить' }),
    rightAction: () => ({ icon: 'edit', color: '#3b82f6', label: 'Изменить' }),
    disabled: false,
    autoPeek: false,
  },
);
const emit = defineEmits<{
  'action-left': [];
  'action-right': [];
}>();
const PEEK_START_DELAY_MS = 500;
const PEEK_DURATION_MS = 1200;
const HINT_DISMISS_DELAY_MS = 1000;

const { translateX, isDragging, resetSwipe, handlers } = useSwipe({
  leftEnabled: !!props.leftAction && !props.disabled,
  rightEnabled: !!props.rightAction && !props.disabled,
});

// Peek animation for onboarding
const hasSeenSwipeHint = useLocalStorage('hasSeenSwipeHint', false);
const peekDirection = computed(() =>
  props.leftAction ? -60 : props.rightAction ? 60 : 0,
);

const showPeekBadge = computed(() => {
  if (isDragging.value || !props.autoPeek || hasSeenSwipeHint.value)
    return false;
  return peekDirection.value < 0 ? translateX.value < 0 : translateX.value > 0;
});

const peekIcon = computed(() =>
  peekDirection.value < 0 ? 'swipe_left' : 'swipe_right',
);

// Timers for cleanup
let startTimer: ReturnType<typeof setTimeout>;
let endTimer: ReturnType<typeof setTimeout>;
let dismissTimer: ReturnType<typeof setTimeout>;

onMounted(() => {
  if (props.autoPeek && !hasSeenSwipeHint.value && !props.disabled) {
    if (peekDirection.value !== 0) {
      startTimer = setTimeout(() => {
        if (!isDragging.value) {
          translateX.value = peekDirection.value;
        }

        endTimer = setTimeout(() => {
          if (!isDragging.value) {
            translateX.value = 0;
          }

          dismissTimer = setTimeout(() => {
            hasSeenSwipeHint.value = true;
          }, HINT_DISMISS_DELAY_MS);
        }, PEEK_DURATION_MS);
      }, PEEK_START_DELAY_MS);
    }
  }
});

onUnmounted(() => {
  clearTimeout(startTimer);
  clearTimeout(endTimer);
  clearTimeout(dismissTimer);
});

// Calculate action button opacity based on swipe distance
const leftActionOpacity = computed(() => {
  if (translateX.value >= 0) return 0;
  return Math.min(Math.abs(translateX.value) / 80, 1);
});

const rightActionOpacity = computed(() => {
  if (translateX.value <= 0) return 0;
  return Math.min(translateX.value / 80, 1);
});

// Handle action click when revealed
function handleLeftAction() {
  emit('action-left');
  resetSwipe();
}

function handleRightAction() {
  emit('action-right');
  resetSwipe();
}

// Touch handlers
function onTouchStart(e: TouchEvent) {
  if (props.disabled) return;
  handlers.onTouchStart(e);
}

function onTouchMove(e: TouchEvent) {
  if (props.disabled) return;
  handlers.onTouchMove(e);
}

function onTouchEnd() {
  if (props.disabled) return;
  handlers.onTouchEnd();

  if (Math.abs(translateX.value) > 20 && !hasSeenSwipeHint.value) {
    hasSeenSwipeHint.value = true;
  }
}

// Expose resetSwipe for parent components
defineExpose({ resetSwipe });
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
        transition: isDragging
          ? 'none'
          : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }"
      role="group"
      :aria-label="isDragging ? 'Смахните для действия' : undefined"
    >
      <!-- Peek Badge Overlay -->
      <div
        v-if="showPeekBadge"
        class="absolute pointer-events-none transition-opacity duration-300 z-10 top-1/2 -translate-y-1/2"
        :class="peekDirection < 0 ? 'right-4' : 'left-4'"
      >
        <UBadge
          variant="neutral"
          class="shadow-sm flex items-center gap-1 opacity-90 animate-pulse"
        >
          <UIcon :name="peekIcon" size="sm" />
          Смахните
        </UBadge>
      </div>

      <slot />
    </div>
  </div>
</template>
