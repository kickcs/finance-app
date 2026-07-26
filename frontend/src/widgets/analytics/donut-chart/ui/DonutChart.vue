<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { IconBadge } from '@/shared/ui';
import {
  formatCurrency,
  COMPACT_BARE_FORMAT,
  formatPercentage,
} from '@/shared/lib/format/currency';
import type { DonutSegment } from '../types';

const props = withDefaults(
  defineProps<{
    segments: DonutSegment[];
    total: number;
    currency: string;
    /** Диаметр кольца в px. */
    size?: number;
    /** Выбранный сегмент; управляется снаружи, чтобы легенда и кольцо были согласованы. */
    selectedId?: string | null;
    title?: string;
  }>(),
  {
    size: 140,
    selectedId: null,
  },
);

const emit = defineEmits<{
  'segment-click': [segment: DonutSegment];
}>();

const isAnimated = ref(false);
useTimeoutFn(() => {
  isAnimated.value = true;
}, 50);

const strokeWidth = computed(() => Math.round(props.size * 0.16));
const radius = computed(() => (props.size - strokeWidth.value) / 2);
const center = computed(() => props.size / 2);

/** Каждый path — точная зона клика по сегменту. */
const segmentPaths = computed(() => {
  if (props.segments.length === 0) return [];

  const gap = 4; // градусов между сегментами
  let currentAngle = -90;
  const r = radius.value;
  const c = center.value;

  return props.segments.map((segment) => {
    const segmentAngle = (segment.percent / 100) * 360 - gap;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + segmentAngle) * Math.PI) / 180;

    const x1 = c + r * Math.cos(startRad);
    const y1 = c + r * Math.sin(startRad);
    const x2 = c + r * Math.cos(endRad);
    const y2 = c + r * Math.sin(endRad);

    const largeArc = segmentAngle > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

    currentAngle += segmentAngle + gap;

    return { ...segment, d };
  });
});

const selectedSegment = computed(() =>
  props.selectedId ? (props.segments.find((s) => s.id === props.selectedId) ?? null) : null,
);

const centerInfo = computed(() => {
  const seg = selectedSegment.value;
  if (seg) return { label: seg.label, value: seg.value, percent: seg.percent, color: seg.color };
  return { label: props.title || 'Всего', value: props.total, percent: null, color: null };
});

/** Центральная надпись сжимается вместе с кольцом, иначе длинная сумма обрезалась. */
const centerBoxStyle = computed(() => ({ maxWidth: `${Math.round(props.size * 0.66)}px` }));
</script>

<template>
  <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        class="stroke-surface-light dark:stroke-surface-dark"
      />

      <path
        v-for="(seg, i) in segmentPaths"
        :key="seg.id"
        :d="seg.d"
        fill="none"
        :stroke="seg.color"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        class="donut-segment cursor-pointer"
        :class="[
          isAnimated ? 'donut-segment--visible' : '',
          selectedId && selectedId !== seg.id ? 'donut-segment--dimmed' : '',
        ]"
        :style="{ '--delay': `${i * 50}ms` }"
        @click="emit('segment-click', seg)"
      />
    </svg>

    <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
      <Transition name="center-fade" mode="out-in">
        <div :key="centerInfo.label" class="flex flex-col items-center" :style="centerBoxStyle">
          <IconBadge
            v-if="selectedSegment?.icon"
            :icon="selectedSegment.icon"
            size="sm"
            :color="selectedSegment.color"
            class="mb-0.5"
          />
          <span
            class="text-caption-sm truncate max-w-full"
            :class="
              centerInfo.color
                ? 'font-medium'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark'
            "
            :style="centerInfo.color ? { color: centerInfo.color } : undefined"
          >
            {{ centerInfo.label }}
          </span>
          <!-- Без символа валюты: внутренний диаметр кольца всего ~96px, и
               символ выдавливал само число за край. -->
          <span
            class="text-body font-bold tabular-nums truncate max-w-full text-text-primary-light dark:text-text-primary-dark"
          >
            {{ formatCurrency(centerInfo.value, currency, COMPACT_BARE_FORMAT) }}
          </span>
          <span
            v-if="centerInfo.percent !== null"
            class="text-caption-sm font-semibold"
            :style="{ color: centerInfo.color! }"
          >
            {{ formatPercentage(centerInfo.percent) }}
          </span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/*
 * Анимируется только opacity. Прежний список включал filter, который здесь
 * никогда не менялся, и stroke-width — тот перерастеризует path в каждом кадре,
 * поэтому приглушение невыбранных сегментов теперь тоже делается прозрачностью.
 */
.donut-segment {
  opacity: 0;
  transition: opacity 0.3s ease-out;
  transition-delay: var(--delay, 0ms);
}

.donut-segment--visible {
  opacity: 1;
  transition-delay: 0ms;
}

.donut-segment--visible.donut-segment--dimmed {
  opacity: 0.25;
}

.center-fade-enter-active,
.center-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.center-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.center-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .donut-segment,
  .center-fade-enter-active,
  .center-fade-leave-active {
    transition: none;
  }
}
</style>
