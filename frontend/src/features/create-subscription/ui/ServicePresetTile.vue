<script setup lang="ts">
import { UIcon, BrandIcon, hasBrandIcon } from '@/shared/ui';
import { quickActionFillStyle } from '@/pages/dashboard/ui/compact/constants';
import type { ServicePreset } from '@/entities/recurring-subscription';

defineProps<{
  preset: ServicePreset | null;
  selected: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    :aria-label="preset?.name ?? 'Свой сервис'"
    class="preset-tile relative flex aspect-square rounded-2xl overflow-hidden group cursor-pointer snap-start shrink-0 w-[calc((100%-30px)/4)] select-none"
    :class="
      preset
        ? [
            'items-end justify-center',
            selected ? 'is-selected' : 'border border-border-light dark:border-border-dark',
          ]
        : [
            'flex-col items-center justify-center gap-1.5 border',
            selected
              ? 'bg-primary/10 border-primary'
              : 'bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark',
          ]
    "
    :style="preset ? quickActionFillStyle(preset.color) : undefined"
    @click="$emit('click')"
  >
    <template v-if="preset">
      <div
        class="absolute inset-0 -top-1 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
      >
        <BrandIcon
          v-if="hasBrandIcon(preset.icon)"
          :name="preset.icon"
          size="xl"
          class="opacity-45 dark:opacity-40"
          :style="{ color: preset.color }"
        />
        <UIcon
          v-else
          :name="preset.icon"
          size="2xl"
          class="opacity-45 dark:opacity-40"
          :style="{ color: preset.color }"
        />
      </div>
      <span
        class="relative z-10 text-caption font-semibold truncate w-full text-center leading-tight tracking-tight px-1 pb-2.5 text-text-primary-light dark:text-text-primary-dark"
      >
        {{ preset.name }}
      </span>
    </template>

    <template v-else>
      <UIcon
        name="add"
        size="lg"
        :class="
          selected
            ? 'text-primary'
            : 'text-text-tertiary-light dark:text-text-tertiary-dark opacity-50 group-hover:text-primary group-hover:opacity-80 transition-all duration-200'
        "
      />
      <span
        class="text-caption font-medium"
        :class="
          selected
            ? 'text-primary'
            : 'text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark transition-colors duration-200'
        "
      >
        Своё
      </span>
    </template>
  </button>
</template>

<style scoped>
.preset-tile {
  transition:
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 220ms ease;
}
.preset-tile:hover {
  transform: translateY(-2px);
}
.preset-tile.is-selected {
  border: 1px solid var(--qa-color, var(--color-primary));
  box-shadow: 0 0 0 1px var(--qa-color, var(--color-primary));
  transform: translateY(-2px);
}
</style>
