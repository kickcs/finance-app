import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';
import { haptics } from '@/shared/lib/haptics';

export const TRANSACTION_TYPE_ORDER = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPE_ORDER)[number];

// Generated from TRANSACTION_TYPE_ORDER: [last_clone, ...real, first_clone]
export const CYCLIC_PANEL_ORDER: TransactionType[] = [
  TRANSACTION_TYPE_ORDER[TRANSACTION_TYPE_ORDER.length - 1],
  ...TRANSACTION_TYPE_ORDER,
  TRANSACTION_TYPE_ORDER[0],
];

const REAL_START = 1;
const REAL_END = CYCLIC_PANEL_ORDER.length - 2;
const PANEL_COUNT = CYCLIC_PANEL_ORDER.length;
// Must be > one Vue reactivity tick but short enough to not block user swipe detection
const WATCHER_GUARD_MS = 100;

export function useScrollableTabs(
  type: Ref<TransactionType>,
  onTypeChange: (type: TransactionType) => void,
) {
  const scrollContainer = ref<HTMLElement | null>(null);
  let isScrollingProgrammatically = false;
  let isWrapping = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollendCleanup: (() => void) | null = null;

  function resetProgrammaticFlag() {
    isScrollingProgrammatically = false;
    scrollendCleanup = null;
  }

  function getRealIndex(t: TransactionType): number {
    return REAL_START + TRANSACTION_TYPE_ORDER.indexOf(t);
  }

  function scrollToIndex(index: number, smooth = true) {
    if (!scrollContainer.value) return;

    // Clean up previous listener if any
    scrollendCleanup?.();

    isScrollingProgrammatically = true;
    const panelWidth = scrollContainer.value.offsetWidth;
    scrollContainer.value.scrollTo({
      left: panelWidth * index,
      behavior: smooth ? 'smooth' : 'instant',
    });

    const handler = () => resetProgrammaticFlag();
    scrollContainer.value.addEventListener('scrollend', handler, {
      once: true,
    });
    scrollendCleanup = () => {
      scrollContainer.value?.removeEventListener('scrollend', handler);
      scrollendCleanup = null;
    };
    // Fallback for browsers without scrollend support
    setTimeout(resetProgrammaticFlag, 600);
  }

  function jumpToIndex(index: number) {
    if (!scrollContainer.value) return;
    const panelWidth = scrollContainer.value.offsetWidth;
    scrollContainer.value.scrollTo({
      left: panelWidth * index,
      behavior: 'instant',
    });
  }

  function getCurrentIndex(): number {
    if (!scrollContainer.value) return REAL_START;
    const panelWidth = scrollContainer.value.offsetWidth;
    return Math.round(scrollContainer.value.scrollLeft / panelWidth);
  }

  // Called after cyclic wrap to force height recalculation on the new panel
  let onWrapCallback: (() => void) | null = null;

  function onCyclicWrap(callback: () => void) {
    onWrapCallback = callback;
  }

  function handleCyclicWrap() {
    const index = getCurrentIndex();

    // Scrolled to the left clone → jump to real last panel
    if (index <= 0) {
      isWrapping = true;
      jumpToIndex(REAL_END);
      onTypeChange(CYCLIC_PANEL_ORDER[REAL_END]);
      isWrapping = false;
      nextTick(() => onWrapCallback?.());
      return true;
    }

    // Scrolled to the right clone → jump to real first panel
    if (index >= PANEL_COUNT - 1) {
      isWrapping = true;
      jumpToIndex(REAL_START);
      onTypeChange(CYCLIC_PANEL_ORDER[REAL_START]);
      isWrapping = false;
      nextTick(() => onWrapCallback?.());
      return true;
    }

    return false;
  }

  function detectPanelFromScroll() {
    if (isScrollingProgrammatically || !scrollContainer.value) return;

    if (handleCyclicWrap()) return;

    const index = getCurrentIndex();
    const clampedIndex = Math.max(REAL_START, Math.min(index, REAL_END));
    const newType = CYCLIC_PANEL_ORDER[clampedIndex];

    if (newType !== type.value) {
      haptics.tap();
      isScrollingProgrammatically = true; // Prevent watch from triggering another scroll
      onTypeChange(newType);
      setTimeout(() => {
        isScrollingProgrammatically = false;
      }, WATCHER_GUARD_MS);
    }
  }

  function handleTabClick(clickedType: TransactionType) {
    const rawIndex = TRANSACTION_TYPE_ORDER.indexOf(clickedType);
    if (rawIndex === -1) return;
    const index = REAL_START + rawIndex;
    onTypeChange(clickedType);
    scrollToIndex(index);
  }

  function handleScrollEnd() {
    if (isScrollingProgrammatically) return;
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    detectPanelFromScroll();
  }

  function handleScroll() {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
      detectPanelFromScroll();
    }, 150);
  }

  onMounted(() => {
    nextTick(() => {
      const index = getRealIndex(type.value);
      scrollToIndex(index, false);
    });
  });

  onUnmounted(() => {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    scrollendCleanup?.();
  });

  watch(type, (newType) => {
    if (isWrapping || isScrollingProgrammatically) return;
    const index = getRealIndex(newType);
    if (!scrollContainer.value) return;

    const currentIndex = getCurrentIndex();
    if (currentIndex !== index) {
      scrollToIndex(index);
    }
  });

  return {
    scrollContainer,
    handleTabClick,
    handleScrollEnd,
    handleScroll,
    onCyclicWrap,
  };
}
