<script setup lang="ts">
import { UInput } from '@/shared/ui'
import CategoryColorPicker from './CategoryColorPicker.vue'
import CategoryIconPicker from './CategoryIconPicker.vue'
import type { CategoryFormData } from '../model/useManageCategories'

defineProps<{
  formData: CategoryFormData
  nameError?: string | null
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:icon': [value: string]
  'update:color': [value: string]
}>()
</script>

<template>
  <div class="space-y-6">
    <UInput
      :model-value="formData.name"
      label="Название"
      placeholder="Введите название категории"
      :error="nameError ?? undefined"
      @update:model-value="emit('update:name', String($event))"
    />

    <CategoryColorPicker
      :model-value="formData.color"
      @update:model-value="emit('update:color', $event)"
    />

    <CategoryIconPicker
      :model-value="formData.icon"
      :color="formData.color"
      @update:model-value="emit('update:icon', $event)"
    />
  </div>
</template>
