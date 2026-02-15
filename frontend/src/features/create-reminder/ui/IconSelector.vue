<script setup lang="ts">
import { UIconSelector } from '@/shared/ui';
import { REMINDER_ICONS } from '@/entities/reminder';

defineProps<{
  modelValue: string;
  color?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <UIconSelector
    :model-value="modelValue"
    :icons="REMINDER_ICONS"
    :color="color"
    label="Иконка"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
