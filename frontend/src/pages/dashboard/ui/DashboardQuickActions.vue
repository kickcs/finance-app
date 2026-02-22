<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import type { QuickAction } from '@/features/configure-quick-action';

defineProps<{
  slots: (QuickAction | null)[];
  categoryMap: Map<string, { icon: string; color: string }>;
  hintDismissed: boolean;
  hidden: boolean;
}>();

const emit = defineEmits<{
  click: [action: QuickAction | null];
  'long-press': [action: QuickAction | null];
  'dismiss-hint': [];
  'settings-click': [];
}>();
</script>

<template>
  <section v-if="!hidden">
    <div class="grid grid-cols-4 gap-3 md:gap-4">
      <button
        v-for="(action, index) in slots"
        :key="action?.id ?? `empty-${index}`"
        :aria-label="
          action
            ? `Добавить расход: ${action.label}`
            : `Настроить быстрое действие, слот ${index + 1}`
        "
        class="flex flex-col items-center gap-1.5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-card-light dark:hover:bg-card-dark active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,background-color] duration-200 group cursor-pointer"
        @click="emit('click', action)"
        @contextmenu.prevent="emit('long-press', action)"
      >
        <template v-if="action">
          <div
            class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
            :style="{
              backgroundColor: (categoryMap.get(action.categoryId)?.color ?? '#64748b') + '1A',
            }"
          >
            <UIcon
              :name="categoryMap.get(action.categoryId)?.icon ?? 'receipt_long'"
              size="sm"
              :style="{
                color: categoryMap.get(action.categoryId)?.color ?? '#64748b',
              }"
            />
          </div>
          <span
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-1"
          >
            {{ action.label }}
          </span>
        </template>
        <template v-else>
          <div
            class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-border-light/50 dark:bg-border-dark/50 group-hover:bg-border-light dark:group-hover:bg-border-dark transition-colors duration-200"
          >
            <UIcon
              name="add"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
            />
          </div>
          <span
            class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
          >
            Добавить
          </span>
        </template>
      </button>
    </div>
    <!-- Hint — shown once until dismissed -->
    <div v-if="!hintDismissed" class="mt-3 flex items-start gap-2 px-1">
      <p class="text-caption-xs leading-snug text-text-tertiary-light dark:text-text-tertiary-dark">
        Удерживайте (или правый клик) для редактирования. Настроить или скрыть — в
        <button
          class="underline text-primary hover:text-primary-hover transition-colors"
          @click="emit('settings-click')"
        >
          Профиль → Быстрые действия
        </button>
        .
      </p>
      <button
        aria-label="Закрыть подсказку"
        class="shrink-0 p-0.5 rounded text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors"
        @click="emit('dismiss-hint')"
      >
        <UIcon name="close" size="xs" />
      </button>
    </div>
  </section>
</template>
