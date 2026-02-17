<script setup lang="ts">
import { UIcon, UButton } from '@/shared/ui';

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
}

const props = withDefaults(defineProps<Props>(), {
  iconSize: 'lg',
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
  <div class="text-center py-12 px-6">
    <!-- Icon -->
    <div
      class="w-14 h-14 mx-auto mb-4 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
    >
      <UIcon
        :name="icon"
        :size="iconSize"
        class="text-text-tertiary-light dark:text-text-tertiary-dark"
      />
    </div>

    <!-- Title -->
    <p
      class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1"
    >
      {{ title }}
    </p>

    <!-- Description -->
    <p
      v-if="description"
      class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark max-w-xs mx-auto"
    >
      {{ description }}
    </p>

    <!-- CTA Button -->
    <UButton
      v-if="action"
      variant="primary"
      size="sm"
      class="mt-4"
      @click="handleAction"
    >
      {{ action.label }}
    </UButton>

    <!-- Slot for custom content -->
    <slot />
  </div>
</template>
