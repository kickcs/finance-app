<script setup lang="ts">
import { computed } from 'vue';
import { formatMasked } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';

/**
 * Долг одной полосой: погашено — прощено — остаток.
 *
 * Заменяет собой раскладку из пяти строк («Сумма долга», «Погашено»,
 * «Осталось»…): те же три величины видны сразу и в пропорции, а не как список
 * чисел, которые читатель складывает в уме. Тот же компонент показывает
 * предпросмотр «что станет после платежа» в шторке — поэтому суммы приходят
 * пропсами, а не выводятся из долга внутри.
 */
const props = withDefaults(
  defineProps<{
    total: number;
    paid: number;
    forgiven?: number;
    currency: string;
    /** Скрывает суммы в подписи; сама полоса остаётся — она не выдаёт величин. */
    hidden?: boolean;
    /** `sm` — только полоса потоньше и подпись в одну строку без «из N». */
    size?: 'sm' | 'md';
  }>(),
  { forgiven: 0, hidden: false, size: 'md' },
);

/**
 * Доли считаем от общей суммы и подрезаем: переплата и рассинхрон кэша не
 * должны выносить полосу за 100%.
 */
const share = (value: number) =>
  props.total > 0 ? Math.min(100, Math.max(0, (value / props.total) * 100)) : 0;

const paidShare = computed(() => share(props.paid));
const forgivenShare = computed(() => Math.min(share(props.forgiven), 100 - paidShare.value));

const paidPercent = computed(() => Math.round(paidShare.value));

/**
 * Сегмент тоньше пары пикселей превращается в точку и читается как артефакт,
 * поэтому нулевые доли не рисуем вовсе, а видимым задаём минимальную ширину.
 * Скруглять сегменты не нужно: внешние торцы даёт `rounded-full` контейнера,
 * внутренние границы обозначает зазор.
 */
const segments = computed(() =>
  [
    { key: 'paid', share: paidShare.value, class: 'bg-success' },
    { key: 'forgiven', share: forgivenShare.value, class: 'bg-warning' },
  ].filter((segment) => segment.share > 0),
);

function money(amount: number): string {
  return formatMasked(amount, props.currency, props.hidden);
}

const caption = computed(() => {
  const parts: string[] = [];
  if (props.paid > 0) parts.push(`Погашено ${money(props.paid)}`);
  if (props.forgiven > 0) parts.push(`прощено ${money(props.forgiven)}`);
  if (parts.length === 0) return null;
  return `${parts.join(' · ')} · ${paidPercent.value}%`;
});

// Ветвим по `hidden`, а не подменяем маску в готовой строке: маска — деталь
// `formatMasked`, и её смена молча превратила бы подпись в ряд точек.
const ariaLabel = computed(() =>
  props.hidden
    ? `Погашено ${paidPercent.value}% из скрытой суммы`
    : `Погашено ${paidPercent.value}% из ${money(props.total)}`,
);
</script>

<template>
  <div :class="size === 'sm' ? 'space-y-1' : 'space-y-1.5'" data-testid="debt-meter">
    <div
      role="img"
      :aria-label="ariaLabel"
      :class="
        cn(
          'flex gap-[2px] overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )
      "
    >
      <span
        v-for="segment in segments"
        :key="segment.key"
        :data-segment="segment.key"
        :class="cn('min-w-[3px] transition-[flex-basis] duration-300 ease-out', segment.class)"
        :style="{ flex: `0 0 ${segment.share}%` }"
      />
    </div>

    <!-- Пустой подписи быть не должно: в предпросмотре шторки она появляется и
         исчезает по мере набора суммы и дёргала бы вёрстку на строку -->
    <p
      v-if="caption"
      class="flex items-baseline justify-between gap-3 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <span class="truncate tabular-nums">{{ caption }}</span>
      <span v-if="size !== 'sm'" class="shrink-0 tabular-nums">из {{ money(total) }}</span>
    </p>
  </div>
</template>
