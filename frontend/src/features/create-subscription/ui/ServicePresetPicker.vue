<script setup lang="ts">
import { SERVICE_PRESETS, type ServicePreset } from '@/entities/recurring-subscription';
import ServicePresetTile from './ServicePresetTile.vue';

defineProps<{
  selected?: string | null;
}>();

const emit = defineEmits<{
  select: [preset: ServicePreset | null, key: string | null];
}>();

const presetEntries = Object.entries(SERVICE_PRESETS);
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-end justify-between px-1">
      <label
        class="text-[11px] uppercase tracking-[0.12em] font-semibold text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        Сервис
      </label>
      <span
        v-if="selected"
        class="text-[11px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        {{ selected === 'custom' ? 'свой' : 'выбран' }}
      </span>
    </div>

    <div
      class="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 pt-1.5 -mt-1.5"
    >
      <ServicePresetTile
        v-for="[key, preset] in presetEntries"
        :key="key"
        :preset="preset"
        :selected="selected === key"
        @click="emit('select', preset, key)"
      />
      <ServicePresetTile
        :preset="null"
        :selected="selected === 'custom'"
        @click="emit('select', null, 'custom')"
      />
    </div>
  </div>
</template>
