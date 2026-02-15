<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';
import { Primitive } from 'reka-ui';
import { cn } from '@/shared/lib/utils';

const _props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none hover:scale-[1.02] active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white hover:bg-primary-hover active:bg-primary-pressed',
        secondary:
          'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark',
        ghost:
          'bg-transparent text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark hover:scale-100 active:scale-100',
        icon: 'bg-transparent text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark !rounded-lg hover:scale-100 active:scale-100',
        danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
        outline:
          'bg-transparent text-primary border border-primary hover:bg-primary-light',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
        xl: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const iconSizeClasses: Record<string, string> = {
  xs: 'w-7 h-7 px-0',
  sm: 'w-8 h-8 px-0',
  md: 'w-10 h-10 px-0',
  lg: 'w-11 h-11 px-0',
  xl: 'w-12 h-12 px-0',
};
</script>

<template>
  <Primitive
    as="button"
    :class="
      cn(
        buttonVariants({
          variant,
          size: variant === 'icon' ? undefined : size,
        }),
        variant === 'icon' && iconSizeClasses[size],
        fullWidth && 'w-full',
      )
    "
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading || undefined"
    :aria-busy="loading || undefined"
    @click="emit('click', $event)"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- Slot content -->
    <slot />
  </Primitive>
</template>
