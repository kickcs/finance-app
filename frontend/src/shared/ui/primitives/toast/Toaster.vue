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
};

// Calculate animation duration (fallback to default 3000ms if not specified)
const getDuration = (duration?: number) => duration || 3000;

type StandardVariant = 'default' | 'success' | 'error' | 'warning';
const toStandardVariant = (v?: string): StandardVariant => (v as StandardVariant) ?? 'default';

function handleTransactionUndo(t: ToasterToast) {
  dismiss(t.id);
  if (t.transactionData?.onUndo) {
    t.transactionData.onUndo();
  }
  showToast({ title: 'Отменено', variant: 'default', duration: 1500 });
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
      <!-- Transaction success: standalone dark toast -->
      <div
        v-if="toast.variant === 'transaction-success' && toast.transactionData"
        v-show="toast.open"
        class="relative rounded-[14px] bg-slate-800 p-3.5 shadow-lg pointer-events-auto"
      >
        <TransactionSuccessToast
          :data="toast.transactionData"
          @undo="handleTransactionUndo(toast)"
          @dismiss="dismiss(toast.id)"
        />
        <!-- Progress bar -->
        <div
          class="absolute bottom-0 left-0 h-[2px] bg-white/10 w-full origin-left rounded-b-[14px] overflow-hidden"
          :style="{
            animation: `shrink ${getDuration(toast.duration)}ms linear forwards`,
          }"
        >
          <div class="h-full w-full bg-emerald-500" />
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
        <!-- Icon -->
        <div v-if="toast.variant && toast.variant !== 'default'" class="flex-shrink-0">
          <UIcon
            :name="variantIcons[toast.variant || 'default']"
            size="sm"
            filled
            :class="{
              'text-success': toast.variant === 'success',
              'text-danger': toast.variant === 'error',
              'text-warning': toast.variant === 'warning',
            }"
          />
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
        <div
          class="absolute bottom-0 left-0 h-[2px] bg-black/10 dark:bg-white/10 w-full origin-left"
          :style="{
            animation: `shrink ${getDuration(toast.duration)}ms linear forwards`,
          }"
        >
          <div
            class="h-full w-full"
            :class="{
              'bg-success': toast.variant === 'success',
              'bg-danger': toast.variant === 'error',
              'bg-warning': toast.variant === 'warning',
              'bg-primary': toast.variant === 'default' || !toast.variant,
            }"
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
</style>
