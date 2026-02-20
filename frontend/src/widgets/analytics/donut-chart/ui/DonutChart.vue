<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { UCard, UIcon, EmptyState } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { DonutSegment } from '../types';

const props = defineProps<{
  segments: DonutSegment[];
  total: number;
  currency: string;
  title?: string;
}>();

const emit = defineEmits<{
  'segment-click': [segment: DonutSegment];
}>();

// Animation state
const isAnimated = ref(false);
const selectedSegment = ref<string | null>(null);

onMounted(() => {
  setTimeout(() => {
    isAnimated.value = true;
  }, 50);
});

// SVG configuration
const size = 180;
const strokeWidth = 28;
const radius = (size - strokeWidth) / 2;
const _circumference = 2 * Math.PI * radius;
const centerX = size / 2;
const centerY = size / 2;

// Calculate segment paths
const segmentPaths = computed(() => {
  if (props.segments.length === 0) return [];

  const gap = 4;
  const _totalPercent = props.segments.reduce((sum, s) => sum + s.percent, 0);
  let currentAngle = -90;

  return props.segments.map((segment, _index) => {
    const segmentAngle = (segment.percent / 100) * 360 - gap;
    const startAngle = currentAngle;
    const endAngle = startAngle + segmentAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArc = segmentAngle > 180 ? 1 : 0;

    currentAngle = endAngle + gap;

    return {
      ...segment,
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      startAngle,
      endAngle,
    };
  });
});

function handleSegmentClick(segment: DonutSegment) {
  selectedSegment.value =
    selectedSegment.value === segment.id ? null : segment.id;
  emit('segment-click', segment);
}

const centerInfo = computed(() => {
  if (selectedSegment.value) {
    const segment = props.segments.find((s) => s.id === selectedSegment.value);
    if (segment) {
      return {
        label: segment.label,
        value: segment.value,
        percent: segment.percent,
      };
    }
  }
  return {
    label: props.title || 'Всего',
    value: props.total,
    percent: 100,
  };
});
</script>

<template>
  <UCard padding="lg" variant="bordered" class="shadow-sm">
    <!-- Donut Chart SVG -->
    <div class="flex justify-center mb-5">
      <div class="relative">
        <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
          <!-- Background circle -->
          <circle
            :cx="centerX"
            :cy="centerY"
            :r="radius"
            fill="none"
            :stroke-width="strokeWidth"
            class="stroke-surface-light dark:stroke-surface-dark"
          />

          <!-- Segments -->
          <path
            v-for="(segment, index) in segmentPaths"
            :key="segment.id"
            :d="segment.d"
            fill="none"
            :stroke="segment.color"
            :stroke-width="strokeWidth"
            stroke-linecap="round"
            class="cursor-pointer transition-opacity duration-150"
            :class="[
              isAnimated ? 'opacity-100' : 'opacity-0',
              selectedSegment && selectedSegment !== segment.id
                ? 'opacity-40'
                : '',
            ]"
            :style="{
              transitionDelay: `${index * 50}ms`,
            }"
            @click="handleSegmentClick(segment)"
          />
        </svg>

        <!-- Center content -->
        <div
          class="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
        >
          <span
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-0.5 truncate max-w-[90px]"
          >
            {{ centerInfo.label }}
          </span>
          <span
            class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate max-w-[100px]"
          >
            {{ formatCurrency(centerInfo.value, currency) }}
          </span>
          <span
            v-if="selectedSegment"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ centerInfo.percent.toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="segment in segments"
        :key="segment.id"
        class="flex items-center gap-2 p-2 rounded-lg transition-colors duration-150 text-left"
        :class="[
          selectedSegment === segment.id
            ? 'bg-surface-light dark:bg-surface-dark'
            : 'hover:bg-surface-light/50 dark:hover:bg-surface-dark/50',
        ]"
        @click="handleSegmentClick(segment)"
      >
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: segment.color }"
        />
        <div class="flex-1 min-w-0">
          <p
            class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ segment.label }}
          </p>
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ segment.percent.toFixed(1) }}%
          </p>
        </div>
      </button>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="segments.length === 0"
      icon="pie_chart"
      title="Нет данных"
      description="Нет транзакций для построения графика"
    />
  </UCard>
</template>
