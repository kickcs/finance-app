<script setup lang="ts">
import { UIcon, Skeleton, DiscoveryDot } from '@/shared/ui';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { QuickAction } from '@/features/configure-quick-action';

defineProps<{
  slots: (QuickAction | null)[];
  categoryMap: Map<string, { icon: string; color: string }>;
  hintDismissed: boolean;
  hidden: boolean;
  loading?: boolean;
  showScanButton?: boolean;
  showScanDot?: boolean;
}>();

const emit = defineEmits<{
  click: [action: QuickAction | null];
  'long-press': [action: QuickAction | null];
  'dismiss-hint': [];
  'settings-click': [];
  'scan-click': [];
}>();

const LONG_PRESS_MS = 500;

const { trigger } = useHaptics();

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTriggered = false;

function onTouchStart(action: QuickAction | null) {
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    trigger('selection');
    emit('long-press', action);
  }, LONG_PRESS_MS);
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onClick(action: QuickAction | null) {
  if (longPressTriggered) return;
  emit('click', action);
}
</script>

<template>
  <section v-if="!hidden">
    <!-- Loading skeleton -->
    <div v-if="loading" class="flex gap-2 pb-1">
      <Skeleton
        v-for="i in showScanButton ? 7 : 6"
        :key="i"
        class="shrink-0 w-[calc((100%-40px)/6)] h-[60px] md:h-[72px] rounded-xl md:rounded-2xl"
      />
    </div>

    <div
      v-else
      class="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 pt-1.5 -mt-1.5 px-1.5 -mx-1.5"
    >
      <!-- Scan receipt button (first item) -->
      <div v-if="showScanButton" class="relative snap-start shrink-0 w-[calc((100%-40px)/6)]">
        <button
          type="button"
          aria-label="Сканировать чек"
          class="relative flex flex-col items-center gap-1 py-2 md:py-3 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-primary/20 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/40 active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 group cursor-pointer w-full"
          @click="emit('scan-click')"
        >
          <!-- Subtle Premium Glow -->
          <div
            class="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-b from-primary/10 to-transparent opacity-100 group-hover:from-primary/15 transition-colors duration-300 pointer-events-none"
          ></div>

          <div
            class="relative z-10 w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center bg-primary transition-transform duration-200 group-hover:scale-110 shadow-sm shadow-primary/30"
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
            class="relative z-10 text-[10px] md:text-xs font-semibold text-text-primary-light dark:text-text-primary-dark whitespace-nowrap transition-colors"
          >
            Скан
          </span>
        </button>
        <DiscoveryDot :show="showScanDot" />
      </div>

      <!-- Quick action slots -->
      <button
        v-for="(action, index) in slots"
        :key="action?.id ?? `empty-${index}`"
        :aria-label="
          action
            ? `Добавить расход: ${action.label}`
            : `Настроить быстрое действие, слот ${index + 1}`
        "
        class="flex flex-col items-center gap-1 py-2 md:py-3 rounded-xl md:rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:-translate-y-1 hover:bg-card-light dark:hover:bg-card-dark active:scale-95 active:translate-y-0 active:shadow-sm transition-[transform,box-shadow,background-color] duration-200 group cursor-pointer snap-start shrink-0 w-[calc((100%-40px)/6)] select-none"
        @click="onClick(action)"
        @contextmenu.prevent="emit('long-press', action)"
        @touchstart.passive="onTouchStart(action)"
        @touchend.passive="onTouchEnd()"
        @touchmove.passive="onTouchMove()"
      >
        <template v-if="action">
          <div
            class="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
            :style="{
              backgroundColor: (categoryMap.get(action.categoryId)?.color ?? '#64748b') + '1A',
            }"
          >
            <UIcon
              :name="categoryMap.get(action.categoryId)?.icon ?? 'receipt_long'"
              size="xs"
              :style="{
                color: categoryMap.get(action.categoryId)?.color ?? '#64748b',
              }"
            />
          </div>
          <span
            class="text-[10px] md:text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate w-full text-center px-0.5 leading-tight"
          >
            {{ action.label }}
          </span>
          <span
            v-if="action.amount != null"
            class="text-[9px] md:text-[10px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark leading-tight"
          >
            {{ formatNumberWithSpaces(action.amount) }}
          </span>
        </template>
        <template v-else>
          <div
            class="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center bg-border-light/50 dark:bg-border-dark/50 group-hover:bg-border-light dark:group-hover:bg-border-dark transition-colors duration-200"
          >
            <UIcon
              name="add"
              size="xs"
              class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
            />
          </div>
          <span
            class="text-[10px] md:text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark"
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
