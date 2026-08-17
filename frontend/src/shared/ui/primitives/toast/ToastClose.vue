<script setup lang="ts">
import type { ToastCloseProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { ToastClose } from 'reka-ui';
import { Cross2Icon } from '@radix-icons/vue';
import { cn } from '@/shared/lib/utils';

const props = defineProps<ToastCloseProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
  <!-- Видим всегда: на тач-устройствах hover не наступает, и крестик, спрятанный
       под group-hover, для телефона равносилен его отсутствию. -->
  <ToastClose
    aria-label="Закрыть"
    :class="
      cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity',
        'text-text-tertiary-light dark:text-text-tertiary-dark',
        'hover:opacity-100 hover:text-text-primary-light dark:hover:text-text-primary-dark',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        props.class,
      )
    "
    v-bind="props"
  >
    <Cross2Icon class="h-4 w-4" />
  </ToastClose>
</template>
