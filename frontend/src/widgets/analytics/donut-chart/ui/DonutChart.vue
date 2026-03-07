<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UCard, IconBadge } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT, formatPercentage } from '@/shared/lib/format/currency';
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

const isAnimated = ref(false);
const selectedSegment = ref<string | null>(null);

useTimeoutFn(() => {
  isAnimated.value = true;
}, 50);

// Reset selection when data changes (e.g. switching expense/income)
watch(
  () => props.segments,
  () => {
    selectedSegment.value = null;
  },
);

// SVG configuration
const size = 200;
const strokeWidth = 28;
const selectedExtra = 4; // extra stroke for selected segment
const radius = (size - strokeWidth - selectedExtra) / 2;
const centerX = size / 2;
const centerY = size / 2;

// Build arc paths — each path is a precise click target
const segmentPaths = computed(() => {
  if (props.segments.length === 0) return [];

  const gap = 4; // degrees gap between segments
  let currentAngle = -90;

  return props.segments.map((segment) => {
    const segmentAngle = (segment.percent / 100) * 360 - gap;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + segmentAngle) * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArc = segmentAngle > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    currentAngle += segmentAngle + gap;

    return { ...segment, d };
  });
});

function handleSegmentClick(segment: DonutSegment) {
  selectedSegment.value = selectedSegment.value === segment.id ? null : segment.id;
  emit('segment-click', segment);
}

const selectedSeg = computed(() =>
  selectedSegment.value ? props.segments.find((s) => s.id === selectedSegment.value) : null,
);

// Reorder so selected segment renders last (on top in SVG)
const orderedPaths = computed(() => {
  if (!selectedSegment.value) return segmentPaths.value;
  const rest = segmentPaths.value.filter((s) => s.id !== selectedSegment.value);
  const active = segmentPaths.value.find((s) => s.id === selectedSegment.value);
  return active ? [...rest, active] : rest;
});

const centerInfo = computed(() => {
  const seg = selectedSeg.value;
  if (seg) return { label: seg.label, value: seg.value, percent: seg.percent, color: seg.color };
  return { label: props.title || 'Всего', value: props.total, percent: null, color: null };
});
</script>

<template>
  <UCard padding="lg">
    <!-- Chart -->
    <div class="flex justify-center">
      <div class="relative">
        <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
          <!-- Background ring -->
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
            v-for="(seg, i) in orderedPaths"
            :key="seg.id"
            :d="seg.d"
            fill="none"
            :stroke="
              !selectedSegment || selectedSegment === seg.id
                ? seg.color
                : 'var(--color-surface-light)'
            "
            :stroke-width="selectedSegment === seg.id ? strokeWidth + selectedExtra : strokeWidth"
            stroke-linecap="round"
            class="donut-segment cursor-pointer dark:[&.donut-segment--grey]:stroke-surface-dark"
            :class="[
              isAnimated ? 'donut-segment--visible' : '',
              selectedSegment && selectedSegment !== seg.id ? 'donut-segment--grey' : '',
            ]"
            :style="{ '--delay': `${i * 60}ms` }"
            @click="handleSegmentClick(seg)"
          />
        </svg>

        <!-- Center content -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Transition name="center-fade" mode="out-in">
            <div :key="centerInfo.label" class="flex flex-col items-center">
              <!-- Selected category icon -->
              <IconBadge
                v-if="selectedSeg?.icon"
                :icon="selectedSeg.icon"
                size="sm"
                :color="selectedSeg.color"
                class="mb-1"
              />
              <span
                class="text-xs mb-0.5 truncate max-w-[110px]"
                :class="
                  centerInfo.color
                    ? 'font-medium'
                    : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                "
                :style="centerInfo.color ? { color: centerInfo.color } : undefined"
              >
                {{ centerInfo.label }}
              </span>
              <span
                class="text-lg font-bold text-text-primary-light dark:text-text-primary-dark truncate max-w-[120px]"
              >
                {{ formatCurrency(centerInfo.value, currency, COMPACT_FORMAT) }}
              </span>
              <span
                v-if="centerInfo.percent !== null"
                class="text-xs font-semibold mt-0.5"
                :style="{ color: centerInfo.color }"
              >
                {{ formatPercentage(centerInfo.percent) }}
              </span>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="mt-4 space-y-1">
      <button
        v-for="seg in segments"
        :key="seg.id"
        class="flex items-center gap-3 w-full py-2.5 rounded-xl text-left transition-all duration-150"
        :class="[
          selectedSegment === seg.id
            ? 'bg-surface-light dark:bg-surface-dark pl-3 pr-3 border-l-[3px]'
            : 'px-3 border-l-[3px] border-transparent active:bg-surface-light dark:active:bg-surface-dark',
          selectedSegment && selectedSegment !== seg.id ? 'opacity-50' : '',
        ]"
        :style="selectedSegment === seg.id ? { borderLeftColor: seg.color } : undefined"
        @click="handleSegmentClick(seg)"
      >
        <IconBadge v-if="seg.icon" :icon="seg.icon" size="sm" :color="seg.color" />
        <span
          v-else
          class="w-3 h-3 rounded-full shrink-0"
          :style="{ backgroundColor: seg.color }"
        />
        <span
          class="flex-1 text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
        >
          {{ seg.label }}
        </span>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums">
          {{ formatPercentage(seg.percent) }}
        </span>
        <span
          class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums"
        >
          {{ formatCurrency(seg.value, currency, COMPACT_FORMAT) }}
        </span>
      </button>
    </div>
  </UCard>
</template>

<style scoped>
.donut-segment {
  opacity: 0;
  transition:
    opacity 0.3s ease-out,
    stroke-width 0.2s ease,
    filter 0.3s ease;
  transition-delay: var(--delay, 0ms);
}

.donut-segment.donut-segment--visible {
  transition-delay: 0ms;
}

.donut-segment--visible {
  opacity: 1;
}

.center-fade-enter-active,
.center-fade-leave-active {
  transition: all 0.15s ease;
}

.center-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.center-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}
</style>
