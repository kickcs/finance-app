<script setup lang="ts">
import { useToast } from '@/shared/lib/composables/useToast';
import { UIcon } from '@/shared/ui/icon';
import Toast from './Toast.vue';
import ToastClose from './ToastClose.vue';
import ToastDescription from './ToastDescription.vue';
import ToastTitle from './ToastTitle.vue';
import ToastAction from './ToastAction.vue';
import ToastViewport from './ToastViewport.vue';

const { toasts, dismiss } = useToast();

const variantIcons: Record<string, string> = {
  default: 'info',
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
};

// Calculate animation duration (fallback to default 3000ms if not specified)
const getDuration = (duration?: number) => duration || 3000;
</script>

<template>
  <ToastViewport>
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :variant="toast.variant"
      :open="toast.open"
      :duration="toast.duration"
      class="relative overflow-hidden group"
      @update:open="(open) => !open && dismiss(toast.id)"
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
      <ToastAction v-if="toast.action" :alt-text="toast.action.label" @click="toast.action.onClick">
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
