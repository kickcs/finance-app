<script setup lang="ts">
import { UIcon } from '@/shared/ui';

defineProps<{
  modelValue: string;
  icons: readonly string[];
  color?: string;
  label?: string;
  maxHeight?: string;
  itemSize?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div class="space-y-3">
    <label
      v-if="label"
      class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div
      class="flex flex-wrap gap-2"
      :class="maxHeight && 'overflow-y-auto'"
      :style="maxHeight ? { maxHeight } : undefined"
    >
      <button
        v-for="icon in icons"
        :key="icon"
        type="button"
        :class="[
          'rounded-xl flex items-center justify-center transition-all duration-200',
          'hover:scale-105 active:scale-95',
          itemSize || 'w-12 h-12',
          modelValue === icon
            ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-background-dark'
            : 'bg-surface-light dark:bg-surface-dark',
        ]"
        :style="
          modelValue === icon ? { backgroundColor: `${color}20` } : undefined
        "
        @click="$emit('update:modelValue', icon)"
      >
        <UIcon
          :name="icon"
          size="md"
          :style="modelValue === icon ? { color } : undefined"
          :class="
            modelValue !== icon &&
            'text-text-secondary-light dark:text-text-secondary-dark'
          "
        />
      </button>
    </div>
  </div>
</template>
