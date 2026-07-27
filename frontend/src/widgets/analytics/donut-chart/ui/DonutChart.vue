<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { formatCurrency, COMPACT_BARE_FORMAT, formatShare } from '@/shared/lib/format/currency';
import { buildArcs, arcPath } from '../model/arcGeometry';
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
    size: 144,
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

/** Обод тоньше диаметра ровно настолько, чтобы в дырке помещалась сумма. */
const strokeWidth = computed(() => Math.round(props.size * 0.12));
const radius = computed(() => (props.size - strokeWidth.value) / 2);
const center = computed(() => props.size / 2);

/** Каждый path — точная зона клика по сегменту. */
const segmentPaths = computed(() => {
  if (props.segments.length === 0) return [];

  const ring = { radius: radius.value, strokeWidth: strokeWidth.value };
  const arcs = buildArcs(
    props.segments.map((s) => s.percent),
    ring,
  );

  return props.segments.map((segment, i) => ({
    ...segment,
    d: arcPath(arcs[i], { radius: radius.value, center: center.value }),
    linecap: arcs[i].linecap,
  }));
});

const selectedSegment = computed(() =>
  props.selectedId ? (props.segments.find((s) => s.id === props.selectedId) ?? null) : null,
);

const centerInfo = computed(() => {
  const seg = selectedSegment.value;
  if (seg) return { label: seg.label, value: seg.value, percent: seg.percent, color: seg.color };
  return { label: props.title || 'Всего', value: props.total, percent: null, color: null };
});

/**
 * Надпись вписывается в прямоугольник внутри кольца, а не в его диаметр: у круга
 * широка только середина, и строка, отмеренная по диаметру, упиралась в обод —
 * сумма приезжала обрезанной как «11,03 м…».
 */
const CENTER_BOX_HEIGHT = 56;

const centerBoxStyle = computed(() => {
  const innerRadius = props.size / 2 - strokeWidth.value;
  const halfHeight = CENTER_BOX_HEIGHT / 2;
  const halfWidth = Math.sqrt(Math.max(0, innerRadius ** 2 - halfHeight ** 2));

  return { maxWidth: `${Math.floor(halfWidth * 2)}px` };
});
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
        :stroke-linecap="seg.linecap"
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
        <!-- Иконка категории сюда не помещается: вместе с тремя строками блок
             перерастал внутренний диаметр и ложился поверх обода. В подсвеченной
             строке легенды под кольцом она и так есть. -->
        <div :key="centerInfo.label" class="flex flex-col items-center" :style="centerBoxStyle">
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
          <!-- Без символа валюты: он назван в заголовке сводки выше, а здесь
               отнимал бы у числа те самые пять-шесть пикселей. -->
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
            {{ formatShare(centerInfo.percent) }}
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

/* 0.25 растворял невыбранные сегменты почти в фон, и кольцо вокруг выбранного
   читалось как обрывок. Треть — всё ещё явно фон, но структура видна. */
.donut-segment--visible.donut-segment--dimmed {
  opacity: 0.35;
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
