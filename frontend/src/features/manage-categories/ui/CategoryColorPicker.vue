<script setup lang="ts">
import { UColorPicker } from '@/shared/ui';
import { CATEGORY_COLORS } from '../model/constants';

defineProps<{
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <UColorPicker
    :model-value="modelValue"
    :colors="CATEGORY_COLORS"
    label="Цвет"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
