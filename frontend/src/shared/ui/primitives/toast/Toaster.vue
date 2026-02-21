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
</script>

<template>
  <ToastViewport>
    <Toast
      v-for="toast in toasts"
      :key="toast.id"
      :variant="toast.variant"
      :open="toast.open"
      :duration="toast.duration"
      @update:open="(open) => !open && dismiss(toast.id)"
    >
      <!-- Icon -->
      <div
        v-if="toast.variant && toast.variant !== 'default'"
        class="flex-shrink-0"
      >
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
        <ToastTitle v-if="toast.title">
          {{ toast.title }}
        </ToastTitle>
        <ToastDescription v-if="toast.description">
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

      <ToastClose />
    </Toast>
  </ToastViewport>
</template>
