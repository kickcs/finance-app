<script setup lang="ts">
import { UColorPicker } from '@/shared/ui';
import { ACCOUNT_COLORS } from '@/entities/account';

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
    :colors="ACCOUNT_COLORS"
    label="Цвет"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
