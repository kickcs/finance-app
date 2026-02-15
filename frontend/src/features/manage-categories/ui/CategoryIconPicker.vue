<script setup lang="ts">
import { UIconSelector } from '@/shared/ui'
import { CATEGORY_ICONS } from '../model/constants'

defineProps<{
  modelValue: string
  color?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <UIconSelector
    :model-value="modelValue"
    :icons="CATEGORY_ICONS"
    :color="color"
    label="Иконка"
    max-height="12rem"
    item-size="w-11 h-11"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
