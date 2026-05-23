import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Ref } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';

export const TRANSACTION_TYPE_ORDER = ['expense', 'income', 'transfer', 'debt'] as const;
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
// Subpixel rounding (HiDPI, zoom) can leave scrollLeft within a couple of pixels of the target.
const PARK_TOLERANCE_PX = 2;
// ~2s at 60fps — guards against infinite rAF when parent is display:none and panelWidth stays 0.
const POLL_MAX_FRAMES = 120;

export function useScrollableTabs(
  type: Ref<TransactionType>,
  onTypeChange: (type: TransactionType) => void,
) {
  const { trigger } = useHaptics();
  const scrollContainer = ref<HTMLElement | null>(null);
  let isScrollingProgrammatically = false;
  let isWrapping = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollendCleanup: (() => void) | null = null;
  // True once the scroller has parked at the type-derived index at least once after mount.
  // While false, scroll events are treated as layout noise (e.g. a browser resetting
  // scrollLeft to 0 after a container resize on mount) rather than real user swipes —
  // without this guard, that reset was misread as a wrap into the left clone, jumping
  // the user onto the "debt" panel.
  let isCarouselReady = false;
  let readyPollHandle: ReturnType<typeof requestAnimationFrame> | null = null;
  let readyPollFrames = 0;

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
      behavior: (smooth ? 'smooth' : 'instant') as ScrollBehavior,
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
      behavior: 'instant' as ScrollBehavior,
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

    // Until the carousel has actually parked at its initial expected index,
    // ignore scroll events. Browsers sometimes reset scrollLeft to 0 after our
    // mount-time scrollTo (e.g. when the container resizes after image / panel
    // children paint). Without this guard, that reset is misread as a swipe
    // into the left clone, and handleCyclicWrap jumps the user to the "debt"
    // panel even though they never touched it.
    if (!isCarouselReady) return;

    if (handleCyclicWrap()) return;

    const index = getCurrentIndex();
    const clampedIndex = Math.max(REAL_START, Math.min(index, REAL_END));
    const newType = CYCLIC_PANEL_ORDER[clampedIndex];

    if (newType !== type.value) {
      trigger('selection');
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
    // Always drive the scroll from here so an idempotent re-click (same type)
    // still parks the carousel (the watcher would no-op since type didn't
    // change). The watcher's own scrollToIndex is idempotent on the same
    // target index, so calling both is safe.
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

  function pollUntilParked() {
    readyPollFrames += 1;
    // Cap to avoid an infinite rAF chain when offsetWidth stays 0 (parent is
    // display:none, hidden tab, etc.). The carousel stays "not ready" — that's
    // fine; the next user interaction will re-arm it via scrollToIndex.
    if (readyPollFrames >= POLL_MAX_FRAMES) {
      readyPollHandle = null;
      return;
    }

    // The ref may not be attached yet on the first frame after onMounted (the
    // template ref lands on next paint). Keep polling instead of giving up —
    // returning early here used to leave the carousel permanently disabled.
    const el = scrollContainer.value;
    if (el) {
      const panelWidth = el.offsetWidth;
      if (panelWidth > 0) {
        // Re-read the target from the live ref each frame: if the parent's
        // onMounted runs setType('debt') after our onMounted, or the user
        // clicks a tab, this loop steers to the new target instead of
        // fighting it.
        const targetIndex = getRealIndex(type.value);
        const target = panelWidth * targetIndex;
        const current = el.scrollLeft;
        if (Math.abs(current - target) > PARK_TOLERANCE_PX) {
          el.scrollTo({ left: target, behavior: 'instant' as ScrollBehavior });
        } else {
          isCarouselReady = true;
          readyPollHandle = null;
          return;
        }
      }
    }
    readyPollHandle = requestAnimationFrame(pollUntilParked);
  }

  onMounted(() => {
    const index = getRealIndex(type.value);
    scrollToIndex(index, false);
    // Wait until the scroller is actually parked at the type-derived index
    // before enabling swipe detection — protects against post-mount layout
    // resets AND lets a parent's onMounted setType(...) steer the initial
    // park to a different panel (e.g. quick-action ?type=income).
    readyPollFrames = 0;
    readyPollHandle = requestAnimationFrame(pollUntilParked);
  });

  onUnmounted(() => {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    if (readyPollHandle !== null) cancelAnimationFrame(readyPollHandle);
    scrollendCleanup?.();
  });

  watch(type, (newType) => {
    if (isWrapping) return;
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
