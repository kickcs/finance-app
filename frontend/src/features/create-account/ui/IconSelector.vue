<script setup lang="ts">
import { UIcon } from '@/shared/ui'
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
  <div class="space-y-3">
    <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
      Иконка
    </label>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="icon in ACCOUNT_ICONS"
        :key="icon"
        type="button"
        :class="[
          'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
          'hover:scale-105 active:scale-95',
          modelValue === icon
            ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-background-dark'
            : 'bg-gray-100 dark:bg-gray-800',
        ]"
        :style="modelValue === icon ? { backgroundColor: `${color}20` } : undefined"
        @click="$emit('update:modelValue', icon)"
      >
        <UIcon
          :name="icon"
          size="md"
          :style="modelValue === icon ? { color } : undefined"
          :class="modelValue !== icon && 'text-text-secondary-light dark:text-text-secondary-dark'"
        />
      </button>
    </div>
  </div>
</template>
