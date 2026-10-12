<script setup lang="ts">
import { computed } from 'vue';

/**
 * Пропорция двух частей оплаты в цветах их счетов. Ширины плавно догоняют
 * ввод: полоска показывает, что изменилось, а не мигает новым состоянием.
 */
const props = defineProps<{
  segments: [Segment, Segment];
}>();

interface Segment {
  label: string;
  amount: number;
  /** Цвет счёта; без него (счёт ещё не выбран) сегмент нейтральный. */
  color?: string | null;
}

const GAP_PX = 3;

const sum = computed(() => props.segments.reduce((acc, s) => acc + Math.max(0, s.amount), 0));

// Зазор только между двумя видимыми сегментами — иначе у края висела бы пустая щель.
const gap = computed(() =>
  props.segments.every((s) => s.amount > 0) && sum.value > 0 ? GAP_PX : 0,
);

const bars = computed(() =>
  props.segments.map((segment) => {
    const share = sum.value > 0 ? Math.max(0, segment.amount) / sum.value : 0;
    return {
      share,
      style: {
        width: `calc((100% - ${gap.value}px) * ${share})`,
        backgroundColor: segment.color ?? undefined,
      },
      neutral: !segment.color,
    };
  }),
);

const ariaLabel = computed(() =>
  sum.value > 0
    ? props.segments
        .map((s, i) => `${s.label} ${Math.round(bars.value[i].share * 100)} %`)
        .join(', ')
    : 'Сумма не указана',
);
</script>

<template>
  <div
    role="img"
    :aria-label="ariaLabel"
    class="flex h-1.5 w-full overflow-hidden rounded-full"
    :class="sum > 0 ? '' : 'bg-border-light dark:bg-border-dark'"
    :style="{ columnGap: `${gap}px` }"
  >
    <span
      v-for="(bar, i) in bars"
      :key="i"
      data-testid="split-segment"
      class="split-segment h-full shrink-0 rounded-full"
      :class="bar.neutral && 'bg-text-tertiary-light/40 dark:bg-text-tertiary-dark/50'"
      :style="bar.style"
    />
  </div>
</template>

<style scoped>
.split-segment {
  transition:
    width 360ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .split-segment {
    transition: none;
  }
}
</style>
