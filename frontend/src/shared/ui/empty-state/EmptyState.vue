<script setup lang="ts">
import { UIcon } from '@/shared/ui/icon';
import { UButton } from '@/shared/ui/button';

interface Action {
  label: string;
  onClick?: () => void;
}

interface Props {
  icon: string;
  title: string;
  description?: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  action?: Action;
  variant?: 'default' | 'inline';
  iconBgClass?: string;
  pulseAction?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  iconSize: 'lg',
  variant: 'default',
  pulseAction: false,
});

const emit = defineEmits<{
  action: [];
}>();

function handleAction() {
  if (props.action?.onClick) {
    props.action.onClick();
  }
  emit('action');
}
</script>

<template>
  <div
    :class="[
      'text-center',
      variant === 'inline'
        ? 'py-8 rounded-xl border border-border-light dark:border-border-dark border-dashed'
        : 'py-12 px-6',
    ]"
  >
    <!-- Icon -->
    <div
      :class="[
        'mx-auto flex items-center justify-center',
        variant === 'inline'
          ? 'w-10 h-10 mb-2 rounded-lg'
          : 'w-14 h-14 mb-4 rounded-xl',
        iconBgClass || 'bg-surface-light dark:bg-surface-dark',
      ]"
    >
      <UIcon
        :name="icon"
        :size="variant === 'inline' ? 'md' : iconSize"
        class="text-text-tertiary-light dark:text-text-tertiary-dark"
      />
    </div>

    <!-- Title -->
    <p
      :class="[
        'text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1',
      ]"
    >
      {{ title }}
    </p>

    <!-- Description -->
    <p
      v-if="description"
      :class="[
        'text-text-tertiary-light dark:text-text-tertiary-dark',
        variant === 'inline' ? 'text-xs mb-4' : 'text-xs max-w-xs mx-auto',
      ]"
    >
      {{ description }}
    </p>

    <!-- CTA Button -->
    <UButton
      v-if="action"
      variant="primary"
      size="sm"
      :class="[
        { 'mt-4': variant === 'default' },
        { 'animate-pulse': pulseAction }
      ]"
      @click="handleAction"
    >
      {{ action.label }}
    </UButton>

    <!-- Slot for custom content -->
    <slot />
  </div>
</template>
