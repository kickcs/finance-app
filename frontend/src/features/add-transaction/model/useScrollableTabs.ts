import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';

export const TRANSACTION_TYPE_ORDER = [
  'expense',
  'income',
  'transfer',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPE_ORDER)[number];

export function useScrollableTabs(
  type: Ref<TransactionType>,
  onTypeChange: (type: TransactionType) => void,
) {
  const scrollContainer = ref<HTMLElement | null>(null);
  let isScrollingProgrammatically = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function resetProgrammaticFlag() {
    isScrollingProgrammatically = false;
  }

  function scrollToPanel(index: number, smooth = true) {
    if (!scrollContainer.value) return;

    isScrollingProgrammatically = true;
    const panelWidth = scrollContainer.value.offsetWidth;
    scrollContainer.value.scrollTo({
      left: panelWidth * index,
      behavior: smooth ? 'smooth' : 'instant',
    });

    scrollContainer.value.addEventListener('scrollend', resetProgrammaticFlag, {
      once: true,
    });
    setTimeout(resetProgrammaticFlag, 600);
  }

  function detectPanelFromScroll() {
    if (isScrollingProgrammatically || !scrollContainer.value) return;

    const container = scrollContainer.value;
    const panelWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / panelWidth);
    const clampedIndex = Math.max(
      0,
      Math.min(index, TRANSACTION_TYPE_ORDER.length - 1),
    );
    const newType = TRANSACTION_TYPE_ORDER[clampedIndex];

    if (newType !== type.value) {
      onTypeChange(newType);
    }
  }

  function handleTabClick(clickedType: string) {
    const index = TRANSACTION_TYPE_ORDER.indexOf(
      clickedType as TransactionType,
    );
    if (index === -1) return;
    onTypeChange(clickedType as TransactionType);
    scrollToPanel(index);
  }

  function handleScrollEnd() {
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
      const index = TRANSACTION_TYPE_ORDER.indexOf(type.value);
      if (index > 0) {
        scrollToPanel(index, false);
      }
    });
  });

  onUnmounted(() => {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
  });

  watch(type, (newType) => {
    const index = TRANSACTION_TYPE_ORDER.indexOf(newType);
    if (index === -1 || !scrollContainer.value) return;

    const panelWidth = scrollContainer.value.offsetWidth;
    const currentIndex = Math.round(
      scrollContainer.value.scrollLeft / panelWidth,
    );

    if (currentIndex !== index) {
      scrollToPanel(index);
    }
  });

  return {
    scrollContainer,
    handleTabClick,
    handleScrollEnd,
    handleScroll,
  };
}
