import { ref, watch, onMounted, nextTick } from 'vue';
import type { Ref, MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { useResizeObserver } from '@vueuse/core';

interface IndicatorStyle {
  [key: string]: string | number;
}

type StyleBuilder = (
  containerRect: DOMRect,
  activeRect: DOMRect,
  scrollLeft: number,
  scrollTop: number,
) => IndicatorStyle;

export function useSlidingIndicator(
  containerRef: Ref<HTMLElement | null>,
  selectedId: MaybeRefOrGetter<string | null>,
  buildStyle: StyleBuilder,
) {
  const chipRefs = new Map<string, HTMLElement>();
  const indicatorStyle = ref<IndicatorStyle>({ opacity: 0 });

  function setChipRef(id: string, el: HTMLElement | null) {
    if (el) chipRefs.set(id, el);
    else chipRefs.delete(id);
  }

  function updateIndicator() {
    const el = containerRef.value;
    const id = toValue(selectedId);
    if (!el || !id) {
      indicatorStyle.value = { ...indicatorStyle.value, opacity: 0 };
      return;
    }

    const active = chipRefs.get(id);
    if (!active) {
      indicatorStyle.value = { ...indicatorStyle.value, opacity: 0 };
      return;
    }

    const containerRect = el.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    indicatorStyle.value = {
      ...buildStyle(containerRect, activeRect, el.scrollLeft, el.scrollTop),
      opacity: 1,
    };
  }

  useResizeObserver(containerRef, updateIndicator);

  onMounted(() => {
    nextTick(updateIndicator);
  });

  watch(
    () => toValue(selectedId),
    () => nextTick(updateIndicator),
  );

  return { chipRefs, setChipRef, indicatorStyle, updateIndicator };
}
