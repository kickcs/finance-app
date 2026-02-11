<script setup lang="ts">
import { UIcon } from '@/shared/ui'
import { ACCOUNT_COLORS } from '@/entities/account'

defineProps<{
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="space-y-3">
    <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
      Цвет
    </label>
    <div class="flex flex-wrap gap-3">
      <button
        v-for="color in ACCOUNT_COLORS"
        :key="color"
        type="button"
        :class="[
          'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
          'hover:scale-110 active:scale-95',
          modelValue === color && 'ring-2 ring-offset-2 dark:ring-offset-background-dark',
        ]"
        :style="{
          backgroundColor: color,
          '--tw-ring-color': modelValue === color ? color : undefined,
        }"
        @click="$emit('update:modelValue', color)"
      >
        <UIcon
          v-if="modelValue === color"
          name="check"
          size="sm"
          class="text-white"
        />
      </button>
    </div>
  </div>
</template>
