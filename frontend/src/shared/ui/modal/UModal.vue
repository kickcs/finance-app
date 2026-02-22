<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import { UIcon } from '../icon';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    closeable?: boolean;
  }>(),
  {
    closeable: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

function handleOpenChange(open: boolean) {
  emit('update:modelValue', open);
  if (!open) {
    emit('close');
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150"
      />
      <DialogContent
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'duration-150',
          )
        "
        @escape-key-down="closeable ? undefined : $event.preventDefault()"
        @pointer-down-outside="closeable ? undefined : $event.preventDefault()"
        @interact-outside="closeable ? undefined : $event.preventDefault()"
      >
        <!-- Header -->
        <div
          v-if="title || closeable"
          class="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark"
        >
          <DialogTitle
            v-if="title"
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            {{ title }}
          </DialogTitle>
          <div v-else />
          <DialogClose
            v-if="closeable"
            class="rounded-lg p-1.5 text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:opacity-80"
          >
            <UIcon name="close" size="sm" />
            <span class="sr-only">Close</span>
          </DialogClose>
        </div>

        <!-- Content -->
        <div class="p-5 overflow-y-auto max-h-[60vh]">
          <slot />
        </div>

        <!-- Actions -->
        <div
          v-if="$slots.actions"
          class="flex gap-3 px-5 py-4 border-t border-border-light dark:border-border-dark"
        >
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
