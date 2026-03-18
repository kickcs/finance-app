<script setup lang="ts">
import { UToggle } from '@/shared/ui';

defineProps<{
  modelValue: boolean;
  title: string;
  description: string;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ title }}
      </p>
      <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
        {{ description }}
      </p>
    </div>
    <UToggle :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" />
  </div>
</template>
