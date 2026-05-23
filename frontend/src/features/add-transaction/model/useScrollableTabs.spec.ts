import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick, type Ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComposable } from '@/test/test-utils';
import { useScrollableTabs, CYCLIC_PANEL_ORDER, type TransactionType } from './useScrollableTabs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 320;
const REAL_START = 1;
const REAL_END = CYCLIC_PANEL_ORDER.length - 2;

/**
 * Attach a fake scroll container to the composable's ref and stub the geometry
 * properties jsdom doesn't compute (offsetWidth, scrollLeft, scrollTo).
 * Returns helpers for driving scroll events and inspecting the current state.
 */
function attachScroller(
  scrollContainer: Ref<HTMLElement | null>,
  panelWidth: number = PANEL_WIDTH,
) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: panelWidth, configurable: true });
  let scrollLeft = 0;
  Object.defineProperty(el, 'scrollLeft', {
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
    configurable: true,
  });
  el.scrollTo = vi.fn((options: ScrollToOptions | number) => {
    const left = typeof options === 'number' ? options : (options?.left ?? 0);
    scrollLeft = left;
  }) as HTMLElement['scrollTo'];

  scrollContainer.value = el;

  return {
    el,
    setScrollLeft(v: number) {
      scrollLeft = v;
    },
    getScrollLeft() {
      return scrollLeft;
    },
  };
}

function setupTabs(initialType: TransactionType = 'expense') {
  const type = ref<TransactionType>(initialType);
  const onTypeChange = vi.fn((t: TransactionType) => {
    type.value = t;
  });

  const { result, wrapper } = mountComposable(() => useScrollableTabs(type, onTypeChange));
  return { type, onTypeChange, result, wrapper };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useScrollableTabs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Mount-time race regression — the original "quick action jumps to Debt" bug
  // -------------------------------------------------------------------------
  describe('mount-time race (regression: quick action → debt panel)', () => {
    it('does NOT wrap to debt when scroll event fires at scrollLeft=0 before carousel is ready', async () => {
      // The composable's onMounted runs before our test attaches the scroller
      // (we don't have access to inject the ref any earlier in mountComposable).
      // That mirrors the production flow where the browser may reset scrollLeft
      // to 0 right after mount, before the carousel has a chance to park —
      // the regression we're guarding against.
      const { type, onTypeChange, result } = setupTabs('expense');
      const scroller = attachScroller(result.scrollContainer);

      await nextTick();
      // scrollLeft is 0 (default) — exactly the production failure mode.
      expect(scroller.getScrollLeft()).toBe(0);

      // A browser-initiated scroll event fires while scrollLeft is still 0.
      // Before the fix this was misread as "user swiped into left clone" and
      // triggered handleCyclicWrap → onTypeChange('debt').
      result.handleScroll();
      vi.advanceTimersByTime(800);
      await flushPromises();

      expect(type.value).toBe('expense');
      expect(onTypeChange).not.toHaveBeenCalledWith('debt');
    });

    it('does NOT wrap when scrollend fires at scrollLeft=0 before carousel is ready', async () => {
      const { type, onTypeChange, result } = setupTabs('expense');
      attachScroller(result.scrollContainer);

      await nextTick();
      // Drain the programmatic-scroll guard set in scrollToIndex.
      vi.advanceTimersByTime(700);

      result.handleScrollEnd();
      await flushPromises();

      expect(type.value).toBe('expense');
      expect(onTypeChange).not.toHaveBeenCalledWith('debt');
    });

    it('honours quick-action type=income — no false wrap to debt', async () => {
      const { type, onTypeChange, result } = setupTabs('income');
      attachScroller(result.scrollContainer);

      await nextTick();
      result.handleScroll();
      vi.advanceTimersByTime(800);
      await flushPromises();

      expect(type.value).toBe('income');
      expect(onTypeChange).not.toHaveBeenCalledWith('debt');
    });

    it('parent setType after child mount parks carousel on the new panel (root cause)', async () => {
      // This mirrors the production quick-action flow:
      //   1. Child useScrollableTabs.onMounted runs (formData.type='expense' default)
      //   2. Parent's onMounted runs setType('debt') from the URL ?type=debt
      // Before the fix: child's onMounted set isScrollingProgrammatically=true,
      // and watch(type) had `if (isScrollingProgrammatically) return`, so the
      // parent's late setType was silently dropped — carousel stayed on expense
      // while formData.type='debt'. The rAF poll has to follow type.value live
      // for this to work.
      vi.useRealTimers();
      const { type, result } = setupTabs('expense');
      const scroller = attachScroller(result.scrollContainer);
      await nextTick();

      // Parent's onMounted lands AFTER child's onMounted (we simulate it here).
      type.value = 'debt';

      // Give the rAF poll a few frames + drain the programmatic-guard fallback.
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => setTimeout(r, 650));

      // The carousel must be parked on the 'debt' panel (index 4), not on
      // the initial 'expense' panel (index 1).
      const debtIndex = REAL_START + CYCLIC_PANEL_ORDER.slice(REAL_START).indexOf('debt');
      expect(scroller.getScrollLeft()).toBe(PANEL_WIDTH * debtIndex);
    });
  });

  // -------------------------------------------------------------------------
  // Tab clicks
  // -------------------------------------------------------------------------
  describe('handleTabClick', () => {
    it('switches type to the clicked tab', async () => {
      const { type, onTypeChange, result } = setupTabs('expense');
      attachScroller(result.scrollContainer);
      await nextTick();

      result.handleTabClick('income');

      expect(onTypeChange).toHaveBeenCalledWith('income');
      expect(type.value).toBe('income');
    });

    it('ignores invalid tab name', async () => {
      const { onTypeChange, result } = setupTabs('expense');
      attachScroller(result.scrollContainer);
      await nextTick();
      onTypeChange.mockClear();

      // @ts-expect-error — testing defensive guard
      result.handleTabClick('nonsense');

      expect(onTypeChange).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Swipe detection after carousel ready
  // -------------------------------------------------------------------------
  describe('swipe detection (post-ready)', () => {
    /**
     * Prepare a "ready" carousel: attach the scroller, then perform an explicit
     * tab click that scrolls to REAL_START — that mirrors a real ready state
     * because the rAF poll observes scrollLeft parked at the target index.
     */
    async function setupReadyCarousel(initialType: TransactionType = 'expense') {
      vi.useRealTimers();
      const { type, onTypeChange, result } = setupTabs(initialType);
      const scroller = attachScroller(result.scrollContainer);
      await nextTick();

      // Manually trigger a scrollToIndex via tab click — this parks the
      // scroller at REAL_START + offset and lets the rAF poller mark ready.
      result.handleTabClick(initialType);
      // Two RAFs are enough for pollUntilParked to observe the parked position.
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      // Drain the 600ms programmatic-guard fallback set in scrollToIndex.
      await new Promise((r) => setTimeout(r, 650));
      onTypeChange.mockClear();

      return { type, onTypeChange, result, scroller };
    }

    it('detects swipe to income and emits the type change', async () => {
      const { type, onTypeChange, result, scroller } = await setupReadyCarousel('expense');

      // User swipes to income (index 2)
      scroller.setScrollLeft(PANEL_WIDTH * 2);
      result.handleScrollEnd();
      await flushPromises();

      expect(onTypeChange).toHaveBeenCalledWith('income');
      expect(type.value).toBe('income');
    });

    it('wraps from right clone (index 5) back to real expense', async () => {
      const { type, onTypeChange, result, scroller } = await setupReadyCarousel('debt');

      // User swipes past debt (index 4) into the right clone of expense
      // (index 5). Wrap should re-park at REAL_START and announce 'expense'.
      scroller.setScrollLeft(PANEL_WIDTH * (REAL_END + 1));
      result.handleScrollEnd();
      await flushPromises();

      expect(onTypeChange).toHaveBeenCalledWith('expense');
      expect(type.value).toBe('expense');
    });

    it('wraps from left clone (index 0) to real debt — only after carousel is ready', async () => {
      const { type, onTypeChange, result, scroller } = await setupReadyCarousel('expense');

      // Genuine swipe from expense (index 1) into the left clone (index 0).
      // Wrap should re-park at REAL_END and announce 'debt'.
      scroller.setScrollLeft(0);
      result.handleScrollEnd();
      await flushPromises();

      expect(onTypeChange).toHaveBeenCalledWith('debt');
      expect(type.value).toBe('debt');
    });
  });
});
