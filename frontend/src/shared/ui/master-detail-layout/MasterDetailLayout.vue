<script setup lang="ts">
import { ref } from 'vue';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { UIcon } from '@/shared/ui';

withDefaults(
  defineProps<{
    selected?: string | null;
    emptyIcon?: string;
    emptyText?: string;
  }>(),
  {
    emptyIcon: undefined,
    emptyText: 'Выберите элемент',
  },
);

defineEmits<{
  close: [];
}>();

const isDesktop = useIsDesktop();

/**
 * Скроллер мастер-колонки. Отдаём его наружу, чтобы страницы не искали
 * контейнер обходом parentElement: по нему шапка понимает, уехал ли под неё
 * контент, а PullToRefresh — тянут ли список от самого верха.
 *
 * Ветки мобильная/десктопная взаимоисключающие (v-if/v-else), поэтому один ref
 * всегда указывает на единственный смонтированный скроллер.
 */
const masterScrollEl = ref<HTMLElement | null>(null);

defineExpose({ masterScrollEl });
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <!-- Горизонтальные отступы живут ВНУТРИ скроллеров: если положить их на
         обёртку, системный скроллбар отрисуется в 20px от края и поедет прямо
         поверх карточек. -->
    <div class="mx-auto max-w-7xl h-full">
      <!-- Desktop: split view -->
      <div v-if="isDesktop" class="flex h-full gap-0">
        <!-- Master panel -->
        <div
          ref="masterScrollEl"
          class="flex-[5] overflow-y-auto overflow-x-hidden overscroll-contain min-w-0 pl-8 pr-4"
        >
          <slot name="master" />
        </div>

        <!-- Divider -->
        <div class="w-px bg-border-light dark:bg-border-dark shrink-0" />

        <!-- Detail panel -->
        <div class="flex-[4] overflow-y-auto overscroll-contain min-w-0 pl-4 pr-8">
          <slot v-if="selected" name="detail" />
          <slot v-else name="empty">
            <div class="h-full flex flex-col items-center justify-center gap-3">
              <div
                v-if="emptyIcon"
                class="w-16 h-16 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
              >
                <UIcon
                  :name="emptyIcon"
                  size="lg"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </div>
              <p class="text-text-tertiary-light dark:text-text-tertiary-dark text-body-sm">
                {{ emptyText }}
              </p>
            </div>
          </slot>
        </div>
      </div>

      <!-- Mobile: master only -->
      <div
        v-else
        ref="masterScrollEl"
        class="h-full overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar px-5 [-webkit-overflow-scrolling:touch]"
      >
        <slot name="master" />
      </div>
    </div>
  </div>
</template>
