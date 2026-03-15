import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref, MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { useResizeObserver, useEventListener } from '@vueuse/core';

export interface IndicatorStyle {
  [key: string]: string | number;
}

export type StyleBuilder = (
  containerRect: DOMRect,
  activeRect: DOMRect,
  scrollLeft: number,
  scrollTop: number,
) => IndicatorStyle;

/**
 * Computes the base rect (left, top, width, height) for a sliding indicator,
 * accounting for container scroll offset. Spread additional style properties on top.
 */
export function buildIndicatorRect(
  containerRect: DOMRect,
  activeRect: DOMRect,
  scrollLeft: number,
  scrollTop: number,
): IndicatorStyle {
  return {
    left: `${activeRect.left - containerRect.left + scrollLeft}px`,
    top: `${activeRect.top - containerRect.top + scrollTop}px`,
    width: `${activeRect.width}px`,
    height: `${activeRect.height}px`,
  };
}

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

  // Throttle scroll updates to one per animation frame
  let scrollRafId = 0;
  function onScroll() {
    if (scrollRafId) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = 0;
      updateIndicator();
    });
  }

  useResizeObserver(containerRef, updateIndicator);
  useEventListener(containerRef, 'scroll', onScroll, { passive: true });

  onMounted(() => {
    nextTick(updateIndicator);
  });

  onUnmounted(() => {
    if (scrollRafId) cancelAnimationFrame(scrollRafId);
  });

  watch(
    () => toValue(selectedId),
    () => nextTick(updateIndicator),
  );

  return { chipRefs, setChipRef, indicatorStyle, updateIndicator };
}
