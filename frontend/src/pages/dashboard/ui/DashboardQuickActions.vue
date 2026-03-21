<script setup lang="ts">
import { onUnmounted } from 'vue';
import { UIcon, Skeleton, DiscoveryDot } from '@/shared/ui';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { QuickAction } from '@/features/configure-quick-action';

defineProps<{
  slots: (QuickAction | null)[];
  categoryMap: Map<string, { name: string; icon: string; color: string }>;
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

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onTouchStart(action: QuickAction | null) {
  clearLongPress();
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    trigger('selection');
    emit('long-press', action);
  }, LONG_PRESS_MS);
}

function onClick(action: QuickAction | null) {
  if (longPressTriggered) return;
  emit('click', action);
}

onUnmounted(clearLongPress);
</script>

<template>
  <section v-if="!hidden">
    <!-- Loading skeleton -->
    <div v-if="loading" class="flex gap-2.5 pb-1 md:grid md:grid-cols-3 md:pb-0">
      <Skeleton
        v-for="i in showScanButton ? 5 : 4"
        :key="i"
        class="shrink-0 w-[calc((100%-30px)/4)] md:w-auto aspect-square rounded-2xl"
      />
    </div>

    <div
      v-else
      class="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 pt-1.5 -mt-1.5 px-1.5 -mx-1.5 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:pt-0 md:mt-0 md:px-0 md:mx-0"
    >
      <!-- Scan receipt button -->
      <div
        v-if="showScanButton"
        class="relative snap-start shrink-0 w-[calc((100%-30px)/4)] md:w-auto md:shrink"
      >
        <button
          type="button"
          aria-label="Сканировать чек"
          class="qa-card relative flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl overflow-hidden bg-card-light dark:bg-card-dark border border-primary/25 group cursor-pointer w-full select-none"
          @click="emit('scan-click')"
        >
          <!-- Top accent line -->
          <div
            class="absolute top-0 left-3 right-3 h-[2px] rounded-full bg-primary/40 group-hover:bg-primary/70 transition-colors duration-300"
          />

          <!-- Background glow -->
          <div
            class="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none"
          />

          <div
            class="relative w-11 h-11 rounded-[14px] flex items-center justify-center bg-primary shadow-[0_2px_8px_-2px] shadow-primary/40 transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
          >
            <UIcon name="document_scanner" size="sm" class="text-white" />
            <!-- Premium badge -->
            <div
              class="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full border-[1.5px] border-card-light dark:border-card-dark shadow-sm flex items-center justify-center"
            >
              <UIcon name="star" size="xs" class="text-white scale-[0.5]" />
            </div>
          </div>

          <span
            class="text-[11px] md:text-xs font-semibold text-text-primary-light dark:text-text-primary-dark tracking-tight"
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
        :class="[
          'qa-card relative flex items-end justify-center aspect-square rounded-2xl overflow-hidden group cursor-pointer snap-start shrink-0 w-[calc((100%-30px)/4)] md:w-auto md:shrink select-none',
          action
            ? 'qa-filled border-0'
            : 'bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark items-center',
        ]"
        :style="
          action
            ? {
                '--qa-color': categoryMap.get(action.categoryId)?.color ?? '#64748b',
                backgroundColor: (categoryMap.get(action.categoryId)?.color ?? '#64748b') + '0A',
              }
            : undefined
        "
        @click="onClick(action)"
        @contextmenu.prevent="emit('long-press', action)"
        @touchstart.passive="onTouchStart(action)"
        @touchend.passive="clearLongPress()"
        @touchmove.passive="clearLongPress()"
      >
        <template v-if="action">
          <!-- Full-card icon — shifted up so text doesn't overlap -->
          <div
            class="absolute inset-0 -top-2 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
          >
            <UIcon
              :name="categoryMap.get(action.categoryId)?.icon ?? 'receipt_long'"
              size="2xl"
              class="opacity-[0.12] dark:opacity-[0.08]"
              :style="{ color: categoryMap.get(action.categoryId)?.color ?? '#64748b' }"
            />
          </div>

          <!-- Amount badge — top right -->
          <span
            v-if="action.amount != null"
            class="absolute top-1.5 right-1.5 z-10 text-[9px] md:text-[10px] font-semibold leading-none tabular-nums px-1.5 py-[3px] rounded-md"
            :style="{
              color: categoryMap.get(action.categoryId)?.color ?? '#64748b',
              backgroundColor: (categoryMap.get(action.categoryId)?.color ?? '#64748b') + '18',
            }"
          >
            {{ formatNumberWithSpaces(action.amount) }}
          </span>

          <!-- Label — bottom center -->
          <span
            class="relative z-10 text-[11px] md:text-xs font-semibold truncate w-full text-center leading-tight tracking-tight px-1 pb-2.5 md:pb-3 text-text-primary-light dark:text-text-primary-dark"
          >
            {{ action.label }}
          </span>
        </template>

        <!-- Empty slot -->
        <template v-else>
          <div class="flex flex-col items-center justify-center gap-1.5 w-full h-full">
            <UIcon
              name="add"
              size="lg"
              class="text-text-tertiary-light dark:text-text-tertiary-dark opacity-40 group-hover:text-primary group-hover:opacity-60 transition-all duration-200"
            />
            <span
              class="text-[11px] md:text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark transition-colors duration-200"
            >
              Добавить
            </span>
          </div>
        </template>
      </button>
    </div>

    <!-- Hint -->
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

<style scoped>
.qa-card {
  box-shadow:
    0 1px 3px -1px rgba(0, 0, 0, 0.08),
    0 2px 6px -2px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.2s ease;
}

.qa-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 12px -2px rgba(0, 0, 0, 0.1),
    0 2px 6px -2px rgba(0, 0, 0, 0.06);
}

.qa-card:active {
  transform: scale(0.96) translateY(0);
  box-shadow:
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    0 1px 3px -1px rgba(0, 0, 0, 0.03);
}

:where(.dark) .qa-card {
  box-shadow:
    0 1px 3px -1px rgba(0, 0, 0, 0.3),
    0 0 0 0.5px rgba(255, 255, 255, 0.04);
}

:where(.dark) .qa-card:hover {
  box-shadow:
    0 4px 16px -2px rgba(0, 0, 0, 0.4),
    0 0 0 0.5px rgba(255, 255, 255, 0.08);
}

:where(.dark) .qa-filled {
  background-color: color-mix(in srgb, var(--qa-color, #64748b) 6%, #18181b);
}
</style>
