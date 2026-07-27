import {
  computed,
  onMounted,
  ref,
  toValue,
  type ComponentPublicInstance,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { packJustifiedRows } from '@/shared/lib/layout/justifyRows';
import { measureTextWidth, resolveFont } from '@/shared/lib/layout/measureTextWidth';

/**
 * Чипы, разложенные по рядам так, чтобы каждый ряд заполнял ширину контейнера.
 *
 * Формула упаковки живёт отдельно (`packJustifiedRows`) и покрыта тестами; здесь
 * — только добыча чисел для неё: ширина контейнера, шрифт и хром чипа.
 */

/** Паддинги + рамка + иконка + зазор, пока ни один чип не измерен. */
const DEFAULT_CHROME = 48;
/** Иконка `size="sm"`, когда её собственный замер недоступен. */
const DEFAULT_ICON = 16;
/**
 * Предел добора ширины на чип. Балансировка почти всегда оставляет ряду
 * небольшой дефицит, и он растворяется в паддингах. Но когда число рядов задано
 * жёстко (пять чипов, по два в ряд — третий ряд неизбежно одиночный), без
 * предела одинокий чип растянулся бы на всю ширину экрана. Лучше оставить
 * недобор, чем показать такой чип.
 */
const DEFAULT_MAX_GROW = 96;

export interface JustifiedChip<T> {
  item: T;
  /** Предел роста чипа в пикселях — натуральная ширина плюс допуск. */
  maxWidth: number;
}

export function useJustifiedRows<T>(
  items: MaybeRefOrGetter<T[]>,
  labelOf: (item: T) => string,
  options: { gap?: number; chromeFallback?: number; maxGrow?: number } = {},
): {
  containerRef: Ref<HTMLElement | null>;
  chipRef: (el: Element | ComponentPublicInstance | null) => void;
  rows: ComputedRef<JustifiedChip<T>[][]>;
  measure: () => void;
} {
  const gap = options.gap ?? 6;
  const maxGrow = options.maxGrow ?? DEFAULT_MAX_GROW;

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const font = ref('');
  const chrome = ref(options.chromeFallback ?? DEFAULT_CHROME);
  const chromeMeasured = ref(false);

  function measure() {
    const el = containerRef.value;
    if (!el) return;
    // Пиксель запаса: `clientWidth` округляет, и на дробной ширине контейнера
    // (343.5 → 344) ряд, посчитанный как «влез ровно», вылезал бы за край —
    // чипы `shrink-0`, сжаться им нечем. `clientWidth`, а не
    // `getBoundingClientRect`: тот учитывает `scale(0.98)` слайд-перехода.
    containerWidth.value = Math.max(0, el.clientWidth - 1);
    const resolved = resolveFont(el);
    if (resolved) font.value = resolved;
  }

  /**
   * Хром чипа читается с живого узла, а не хардкодится копией CSS-классов.
   * Паддинги, рамка, зазор и иконка не зависят от `flex-grow` — растягивается
   * content-box, — поэтому читать их можно и с уже растянутого чипа: второго
   * прохода не возникает.
   */
  function chipRef(el: Element | ComponentPublicInstance | null) {
    if (chromeMeasured.value) return;
    const node = (el as ComponentPublicInstance | null)?.$el ?? el;
    if (!(node instanceof HTMLElement)) return;

    const style = getComputedStyle(node);
    const box =
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.borderRightWidth);
    if (!Number.isFinite(box) || box <= 0) return;

    const icon = node.querySelector('svg');
    const iconWidth = icon ? icon.getBoundingClientRect().width || DEFAULT_ICON : 0;
    const columnGap = parseFloat(style.columnGap) || 0;

    chrome.value = box + iconWidth + (iconWidth ? columnGap : 0);
    chromeMeasured.value = true;
  }

  onMounted(measure);

  // Первый вызов ResizeObserver приходит асинхронно — до него раскладку держит
  // синхронный замер на монтировании.
  useResizeObserver(containerRef, measure);

  // Метрики шрифта до его загрузки врут — после загрузки пересчитываем.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(measure);
  }

  const widths = computed(() =>
    toValue(items).map((item) => chrome.value + measureTextWidth(labelOf(item), font.value)),
  );

  const rows = computed<JustifiedChip<T>[][]>(() => {
    const list = toValue(items);
    const itemWidths = widths.value;
    return packJustifiedRows(itemWidths, containerWidth.value, gap).map((row) =>
      row.map((index) => ({ item: list[index], maxWidth: itemWidths[index] + maxGrow })),
    );
  });

  return { containerRef, chipRef, rows, measure };
}
