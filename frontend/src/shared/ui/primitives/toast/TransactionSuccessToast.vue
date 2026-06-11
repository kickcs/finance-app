<script setup lang="ts">
import { ref } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import type { TransactionToastData } from '@/shared/lib/composables/useToast';

defineProps<{
  data: TransactionToastData;
}>();

const emit = defineEmits<{
  undo: [];
  dismiss: [];
}>();

const { trigger } = useHaptics();
const isUndoing = ref(false);

function handleUndo() {
  if (isUndoing.value) return;
  isUndoing.value = true;
  trigger('light');
  emit('undo');
}
</script>

<template>
  <div class="relative flex items-center gap-3">
    <!-- Success badge: pop-in circle + expanding ring + drawn checkmark -->
    <div class="relative h-9 w-9 flex-shrink-0">
      <span class="success-badge-ring absolute inset-0 rounded-full bg-success/40" />
      <span
        class="success-badge-circle relative flex h-full w-full items-center justify-center rounded-full bg-success shadow-sm shadow-success/30"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="checkmark-icon">
          <path
            d="M4 8.5L7 11.5L12 5"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <p
        class="truncate text-body font-semibold tabular-nums tracking-tight text-text-primary-light dark:text-text-primary-dark"
      >
        {{ data.amount }}
      </p>
      <p
        class="mt-0.5 truncate text-body-sm text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ data.categoryName }} · {{ data.accountName }}
      </p>
    </div>

    <button
      class="flex-shrink-0 whitespace-nowrap rounded-xl bg-primary-light px-3 py-2 text-body-sm font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:text-primary-hover"
      :disabled="isUndoing"
      @click="handleUndo"
    >
      {{ isUndoing ? '…' : 'Отменить' }}
    </button>
  </div>
</template>

<style scoped>
.success-badge-circle {
  animation: badge-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.success-badge-ring {
  animation: badge-ring 0.7s ease-out 0.15s both;
}

.checkmark-icon path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: draw-check 0.35s ease-out 0.25s forwards;
}

@keyframes badge-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes badge-ring {
  from {
    transform: scale(0.6);
    opacity: 0.8;
  }
  to {
    transform: scale(1.7);
    opacity: 0;
  }
}

@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .success-badge-circle,
  .success-badge-ring {
    animation: none;
  }

  .checkmark-icon path {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
