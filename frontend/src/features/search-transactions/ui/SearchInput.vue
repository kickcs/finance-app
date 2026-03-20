<script setup lang="ts">
import { UInput } from '@/shared/ui';

defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  clear: [];
}>();
</script>

<template>
  <UInput
    :model-value="modelValue"
    variant="search"
    :placeholder="placeholder || 'Поиск...'"
    data-testid="search-input"
    @update:model-value="$emit('update:modelValue', $event as string)"
    @clear="$emit('clear')"
  />
</template>
