<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { SERVICE_PRESETS, type ServicePreset } from '@/entities/recurring-subscription';

defineProps<{
  selected?: string | null;
}>();

const emit = defineEmits<{
  select: [preset: ServicePreset | null, key: string | null];
}>();

const presetEntries = Object.entries(SERVICE_PRESETS);
</script>

<template>
  <div class="space-y-2">
    <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
      Выбрать сервис
    </label>
    <div class="grid grid-cols-3 md:grid-cols-4 gap-2">
      <button
        v-for="[key, preset] in presetEntries"
        :key="key"
        type="button"
        class="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150"
        :class="
          selected === key
            ? 'border-primary ring-2 ring-primary bg-primary/5'
            : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:bg-surface-light dark:hover:bg-surface-dark'
        "
        @click="emit('select', preset, key)"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center"
          :style="{ backgroundColor: preset.color + '1A' }"
        >
          <UIcon name="subscriptions" size="sm" :style="{ color: preset.color }" />
        </div>
        <span
          class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark text-center leading-tight line-clamp-2"
        >
          {{ preset.name }}
        </span>
      </button>

      <!-- Custom option -->
      <button
        type="button"
        class="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150"
        :class="
          selected === 'custom'
            ? 'border-primary ring-2 ring-primary bg-primary/5'
            : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:bg-surface-light dark:hover:bg-surface-dark'
        "
        @click="emit('select', null, 'custom')"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-light dark:bg-surface-dark"
        >
          <UIcon
            name="add"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark"
          />
        </div>
        <span
          class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark text-center leading-tight"
        >
          Другое
        </span>
      </button>
    </div>
  </div>
</template>
