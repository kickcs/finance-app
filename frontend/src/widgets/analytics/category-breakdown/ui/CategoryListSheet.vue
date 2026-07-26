<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import CategoryLegendRow from './CategoryLegendRow.vue';
import type { DonutSegment } from '../../donut-chart/types';

defineProps<{
  open: boolean;
  segments: DonutSegment[];
  total: number;
  currency: string;
  selectedId?: string | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [segment: DonutSegment];
}>();

const isDesktop = useIsDesktop();
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        data-testid="category-list-sheet"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div
          class="px-5 pb-2 flex items-baseline justify-between gap-2"
          :class="{ 'pt-4': isDesktop }"
        >
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Все категории
          </DrawerTitle>
          <span
            class="text-body-sm font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark"
          >
            {{ formatCurrency(total, currency, COMPACT_FORMAT) }}
          </span>
        </div>

        <div class="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
          <CategoryLegendRow
            v-for="seg in segments"
            :key="seg.id"
            :segment="seg"
            :currency="currency"
            :selected="selectedId === seg.id"
            @click="emit('select', seg)"
          />
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
