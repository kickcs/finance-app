<script setup lang="ts">
import { UIconSelector } from '@/shared/ui'
import { ACCOUNT_ICONS } from '@/entities/account'

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
    :icons="ACCOUNT_ICONS"
    :color="color"
    label="Иконка"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
