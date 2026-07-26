<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UCard, UTabs, EmptyState, Skeleton } from '@/shared/ui';
import DonutChart from '../../donut-chart/ui/DonutChart.vue';
import CategoryLegendRow from './CategoryLegendRow.vue';
import CategoryListSheet from './CategoryListSheet.vue';
import type { DonutSegment } from '../../donut-chart/types';

const props = defineProps<{
  segments: DonutSegment[];
  total: number;
  currency: string;
  categoryType: 'expense' | 'income';
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:categoryType': [value: 'expense' | 'income'];
}>();

const TYPE_ITEMS = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

/** Легенда рядом с кольцом вмещает пять строк без прокрутки — остальное в шторке. */
const TOP_LIMIT = 5;

const selectedId = ref<string | null>(null);
const showAll = ref(false);

// Смена расходов на доходы меняет весь набор — прежний выбор к нему не относится.
watch(
  () => props.segments,
  () => {
    selectedId.value = null;
  },
);

const topSegments = computed(() => props.segments.slice(0, TOP_LIMIT));
const hiddenCount = computed(() => Math.max(0, props.segments.length - TOP_LIMIT));

function toggleSegment(segment: DonutSegment) {
  selectedId.value = selectedId.value === segment.id ? null : segment.id;
}
</script>

<template>
  <UCard padding="md">
    <UTabs
      :model-value="categoryType"
      :items="TYPE_ITEMS"
      size="sm"
      class="mb-3"
      @update:model-value="emit('update:categoryType', $event as 'expense' | 'income')"
    />

    <div v-if="loading" class="flex items-center gap-4">
      <Skeleton class="w-[140px] h-[140px] rounded-full shrink-0" />
      <div class="flex-1 space-y-2">
        <Skeleton v-for="i in 5" :key="i" class="h-7 rounded" />
      </div>
    </div>

    <EmptyState
      v-else-if="segments.length === 0"
      icon="pie_chart"
      title="Нет данных"
      description="За выбранный период нет транзакций для разбивки"
    />

    <!--
      На телефоне кольцо и легенда делят ~316px, и на имя категории остаётся
      меньше полусотни — «Образование» превращается в «Обр…». Поэтому колонкой
      до sm и рядом только там, где ширины хватает обоим.
    -->
    <div v-else class="flex flex-col items-center gap-3 sm:flex-row sm:gap-4 sm:items-start">
      <DonutChart
        :segments="segments"
        :total="total"
        :currency="currency"
        :selected-id="selectedId"
        :size="112"
        @segment-click="toggleSegment"
      />

      <div class="w-full min-w-0 space-y-0.5">
        <CategoryLegendRow
          v-for="seg in topSegments"
          :key="seg.id"
          :segment="seg"
          :currency="currency"
          :selected="selectedId === seg.id"
          :dimmed="!!selectedId && selectedId !== seg.id"
          @click="toggleSegment(seg)"
        />

        <button
          v-if="hiddenCount > 0"
          type="button"
          data-testid="category-show-all"
          class="w-full px-2 py-1.5 rounded-lg text-left text-body-sm font-medium text-primary transition-colors active:bg-surface-light dark:active:bg-surface-dark"
          @click="showAll = true"
        >
          Все категории ({{ segments.length }})
        </button>
      </div>
    </div>

    <CategoryListSheet
      :open="showAll"
      :segments="segments"
      :total="total"
      :currency="currency"
      :selected-id="selectedId"
      @update:open="showAll = $event"
      @select="toggleSegment"
    />
  </UCard>
</template>
