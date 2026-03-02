<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import type { QuickAction } from '@/features/configure-quick-action';

defineProps<{
  slots: (QuickAction | null)[];
  categoryMap: Map<string, { icon: string; color: string }>;
  hintDismissed: boolean;
  hidden: boolean;
  loading?: boolean;
  showScanButton?: boolean;
}>();

const emit = defineEmits<{
  click: [action: QuickAction | null];
  'long-press': [action: QuickAction | null];
  'dismiss-hint': [];
  'settings-click': [];
  'scan-click': [];
}>();
</script>

<template>
  <section v-if="!hidden">
    <!-- Loading skeleton -->
    <div v-if="loading" class="flex gap-3 md:gap-4 pb-1">
      <Skeleton
        v-for="i in showScanButton ? 5 : 4"
        :key="i"
        class="shrink-0 w-[calc((100%-36px)/4)] h-[76px] md:h-[88px] rounded-xl md:rounded-2xl"
      />
    </div>

    <div v-else class="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
      <!-- Scan receipt button (first item) -->
      <button
        v-if="showScanButton"
        type="button"
        aria-label="Сканировать чек"
        class="relative flex flex-col items-center gap-1.5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-primary/20 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/40 active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 group cursor-pointer snap-start shrink-0 w-[calc((100%-36px)/4)] overflow-hidden"
        @click="emit('scan-click')"
      >
        <!-- Subtle Premium Glow -->
        <div
          class="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-100 group-hover:from-primary/15 transition-colors duration-300 pointer-events-none"
        ></div>

        <div
          class="relative z-10 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-primary transition-transform duration-200 group-hover:scale-110 shadow-sm shadow-primary/30"
        >
          <UIcon name="document_scanner" size="sm" class="text-white" />

          <!-- Small subtle premium indicator dot -->
          <div
            class="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full border-2 border-surface-light dark:border-surface-dark shadow-sm flex items-center justify-center"
          >
            <UIcon name="star" size="xs" class="text-white scale-[0.5]" />
          </div>
        </div>

        <span
          class="relative z-10 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark whitespace-nowrap transition-colors"
        >
          Сканировать
        </span>
      </button>

      <!-- Quick action slots -->
      <button
        v-for="(action, index) in slots"
        :key="action?.id ?? `empty-${index}`"
        :aria-label="
          action
            ? `Добавить расход: ${action.label}`
            : `Настроить быстрое действие, слот ${index + 1}`
        "
        class="flex flex-col items-center gap-1.5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-card-light dark:hover:bg-card-dark active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,background-color] duration-200 group cursor-pointer snap-start shrink-0 w-[calc((100%-36px)/4)]"
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
    <div v-if="!loading && !hintDismissed" class="mt-3 flex items-start gap-2 px-1">
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
