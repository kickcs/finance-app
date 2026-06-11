<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { useToast, type ToasterToast } from '@/shared/lib/composables/useToast';
import { UIcon } from '@/shared/ui/icon';
import Toast from './Toast.vue';
import ToastClose from './ToastClose.vue';
import ToastDescription from './ToastDescription.vue';
import ToastTitle from './ToastTitle.vue';
import ToastAction from './ToastAction.vue';
import ToastViewport from './ToastViewport.vue';
import TransactionSuccessToast from './TransactionSuccessToast.vue';

const { toasts, dismiss, toast: showToast } = useToast();

const variantIcons: Record<string, string> = {
  default: 'info',
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  undo: 'undo',
};

const variantIconClasses: Record<string, string> = {
  success: 'bg-success-light text-success',
  error: 'bg-danger-light text-danger',
  warning: 'bg-warning-light text-warning',
  undo: 'bg-primary-light text-primary dark:text-primary-hover',
};

const variantProgressClasses: Record<string, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  undo: 'bg-primary',
};

// Calculate animation duration (fallback to default 3000ms if not specified)
const getDuration = (duration?: number) => duration || 3000;

type StandardVariant = 'default' | 'success' | 'error' | 'warning' | 'undo';
const toStandardVariant = (v?: string): StandardVariant => (v as StandardVariant) ?? 'default';

function handleTransactionUndo(t: ToasterToast) {
  dismiss(t.id);
  if (t.transactionData?.onUndo) {
    t.transactionData.onUndo();
  }
  showToast({
    title: 'Отменено',
    description: 'Транзакция удалена',
    variant: 'undo',
    duration: 2000,
  });
}

// Auto-dismiss transaction-success toasts (standalone divs don't use Reka UI auto-dismiss)
const autoDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

watch(toasts, (current) => {
  for (const t of current) {
    if (t.variant === 'transaction-success' && t.open && !autoDismissTimers.has(t.id)) {
      const duration = t.duration || 5000;
      autoDismissTimers.set(
        t.id,
        setTimeout(() => {
          dismiss(t.id);
          autoDismissTimers.delete(t.id);
        }, duration),
      );
    }
  }
  // Clean up timers for removed toasts
  for (const id of autoDismissTimers.keys()) {
    if (!current.find((t) => t.id === id)) {
      clearTimeout(autoDismissTimers.get(id));
      autoDismissTimers.delete(id);
    }
  }
});

onUnmounted(() => {
  for (const timer of autoDismissTimers.values()) {
    clearTimeout(timer);
  }
  autoDismissTimers.clear();
});
</script>

<template>
  <ToastViewport>
    <template v-for="toast in toasts" :key="toast.id">
      <!-- Transaction success: glass card on design tokens -->
      <div
        v-if="toast.variant === 'transaction-success' && toast.transactionData"
        class="transaction-toast pointer-events-auto relative mt-1.5 w-full max-w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-border-light/40 bg-card-light/85 p-3.5 shadow-lg shadow-black/5 backdrop-blur-md dark:border-border-dark/50 dark:bg-card-dark/85 dark:shadow-black/20"
        :class="toast.open ? 'transaction-toast-enter' : 'transaction-toast-leave'"
      >
        <!-- Soft success wash behind the badge -->
        <div
          class="pointer-events-none absolute inset-0"
          style="
            background: radial-gradient(
              140px circle at 2.5rem 50%,
              color-mix(in srgb, var(--color-success) 10%, transparent),
              transparent 70%
            );
          "
        />
        <TransactionSuccessToast
          :data="toast.transactionData"
          @undo="handleTransactionUndo(toast)"
          @dismiss="dismiss(toast.id)"
        />
        <!-- Progress bar -->
        <div class="absolute bottom-0 left-0 h-[2.5px] w-full bg-black/5 dark:bg-white/10">
          <div
            class="h-full w-full origin-left bg-success"
            :style="{ animation: `shrink ${getDuration(toast.duration)}ms linear forwards` }"
          />
        </div>
      </div>

      <!-- Standard toasts -->
      <Toast
        v-else
        :variant="toStandardVariant(toast.variant)"
        :open="toast.open"
        :duration="toast.duration"
        class="relative overflow-hidden group"
        @update:open="(open: boolean) => !open && dismiss(toast.id)"
      >
        <!-- Icon in tinted badge -->
        <div
          v-if="toast.variant && toast.variant !== 'default'"
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
          :class="variantIconClasses[toast.variant]"
        >
          <UIcon :name="variantIcons[toast.variant || 'default']" size="xs" filled />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <ToastTitle v-if="toast.title" class="text-[0.8125rem] font-medium leading-tight">
            {{ toast.title }}
          </ToastTitle>
          <ToastDescription
            v-if="toast.description"
            class="text-[0.75rem] opacity-80 leading-tight mt-0.5"
          >
            {{ toast.description }}
          </ToastDescription>
        </div>

        <!-- Action -->
        <ToastAction
          v-if="toast.action"
          :alt-text="toast.action.label"
          @click="toast.action.onClick"
        >
          {{ toast.action.label }}
        </ToastAction>

        <ToastClose
          :class="
            toast.action ? 'opacity-60' : 'opacity-0 group-hover:opacity-100 transition-opacity'
          "
        />

        <!-- Progress bar -->
        <div class="absolute bottom-0 left-0 h-[2px] w-full bg-black/5 dark:bg-white/10">
          <div
            class="h-full w-full origin-left"
            :class="variantProgressClasses[toast.variant || 'default']"
            :style="{ animation: `shrink ${getDuration(toast.duration)}ms linear forwards` }"
          />
        </div>
      </Toast>
    </template>
  </ToastViewport>
</template>

<style>
@keyframes shrink {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.transaction-toast-enter {
  animation: tx-toast-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
}

.transaction-toast-leave {
  animation: tx-toast-out 0.2s ease-in forwards;
}

@keyframes tx-toast-in {
  from {
    opacity: 0;
    transform: translateY(100%) scale(0.92);
  }
}

@keyframes tx-toast-out {
  to {
    opacity: 0;
    transform: translateY(20%) scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .transaction-toast-enter,
  .transaction-toast-leave {
    animation-duration: 0.01ms;
  }
}
</style>
