<script setup lang="ts">
import { UInput, UColorPicker, UIconSelector } from '@/shared/ui';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../model/constants';
import type { CategoryFormData } from '../model/useManageCategories';

defineProps<{
  formData: CategoryFormData;
  nameError?: string | null;
}>();

const emit = defineEmits<{
  'update:name': [value: string];
  'update:icon': [value: string];
  'update:color': [value: string];
}>();
</script>

<template>
  <div class="space-y-6">
    <UInput
      :model-value="formData.name"
      label="Название"
      placeholder="Введите название категории"
      :error="nameError ?? undefined"
      data-testid="category-name-input"
      @update:model-value="emit('update:name', String($event))"
    />

    <UColorPicker
      :model-value="formData.color"
      :colors="CATEGORY_COLORS"
      label="Цвет"
      @update:model-value="emit('update:color', $event)"
    />

    <UIconSelector
      :model-value="formData.icon"
      :icons="CATEGORY_ICONS"
      :color="formData.color"
      label="Иконка"
      max-height="12rem"
      item-size="w-11 h-11"
      @update:model-value="emit('update:icon', $event)"
    />
  </div>
</template>
