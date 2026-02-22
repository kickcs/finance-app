<script setup lang="ts">
import { cn } from '@/shared/lib/utils';

export interface CardProps {
  variant?: 'default' | 'bordered' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  clickable?: boolean;
}

const props = withDefaults(defineProps<CardProps>(), {
  variant: 'default',
  padding: 'md',
  hoverable: false,
  clickable: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

function handleKeydown(event: KeyboardEvent) {
  if (!props.clickable) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('click', event as unknown as MouseEvent);
  }
}

const paddingClasses: Record<string, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'rounded-xl transition-all duration-150',
        variant === 'default' &&
          'bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark',
        variant === 'bordered' &&
          'bg-transparent border border-border-light dark:border-border-dark',
        variant === 'flat' && 'bg-surface-light dark:bg-surface-dark',
        paddingClasses[padding],
        hoverable && 'hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-sm',
        clickable &&
          'cursor-pointer active:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:shadow-sm',
      )
    "
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable ? emit('click', $event) : undefined"
    @keydown="handleKeydown"
  >
    <slot />
  </div>
</template>
