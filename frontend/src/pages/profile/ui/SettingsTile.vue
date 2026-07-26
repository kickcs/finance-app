<script setup lang="ts">
import { UIcon } from '@/shared/ui';

defineProps<{
  icon: string;
  label: string;
  /** Текущее значение настройки. Плитки-разделы его не имеют. */
  value?: string;
  /** Заливка чипа иконки — используется плиткой «Основной цвет», чтобы показать цвет пигментом. */
  accentColor?: string;
  /** Точка непрочитанного (например, новый changelog). */
  badge?: boolean;
  spinning?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="flex w-full flex-col justify-center gap-1 rounded-xl border border-border-light bg-card-light px-3 py-2.5 text-left transition-colors hover:border-primary/30 active:bg-surface-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-border-dark dark:bg-card-dark dark:hover:border-primary/30 dark:active:bg-surface-dark"
  >
    <span class="flex items-center gap-2">
      <span
        class="relative grid h-6 w-6 shrink-0 place-items-center rounded-lg"
        :class="accentColor ? '' : 'bg-surface-light dark:bg-surface-dark'"
        :style="accentColor ? { backgroundColor: accentColor } : undefined"
        :data-testid="accentColor ? 'color-dot' : undefined"
      >
        <UIcon
          :name="icon"
          size="xs"
          :class="[
            accentColor ? 'text-white' : 'text-text-secondary-light dark:text-text-secondary-dark',
            spinning && 'animate-spin',
          ]"
        />
        <span
          v-if="badge"
          data-testid="unseen-badge"
          class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-card-light dark:ring-card-dark"
        />
      </span>
      <span
        class="line-clamp-2 min-w-0 flex-1 text-body-sm font-medium leading-tight text-text-primary-light dark:text-text-primary-dark"
      >
        {{ label }}
      </span>
    </span>
    <span
      v-if="value"
      class="truncate pl-8 text-caption font-medium leading-tight text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ value }}
    </span>
  </button>
</template>
