import { onBeforeUnmount, type Ref } from 'vue';

/**
 * Manages iOS virtual keyboard adjustment for vaul-vue bottom drawers.
 * Uses direct DOM manipulation (not reactive state) to avoid Vue re-renders
 * that cause input focus loss when the keyboard appears.
 */
export function useDrawerKeyboard(
  drawerContentRef: Ref<{ $el?: HTMLElement } | null>,
  footerRef: Ref<HTMLDivElement | null>,
  scrollContainerRef: Ref<HTMLDivElement | null>,
) {
  let cleanupViewport: (() => void) | null = null;

  function setupKeyboardListener() {
    cleanupKeyboardListener();
    const vv = window.visualViewport;
    if (!vv) return;
    const drawerEl = drawerContentRef.value?.$el as HTMLElement | undefined;
    if (!drawerEl) return;

    let wasKeyboardVisible = false;

    const onResize = () => {
      const footerEl = footerRef.value;
      const scrollEl = scrollContainerRef.value;
      const offset = Math.max(0, window.innerHeight - vv.height);
      const keyboardVisible = offset > 0;
      drawerEl.style.bottom = keyboardVisible ? `${offset}px` : '';
      drawerEl.style.top = keyboardVisible ? 'env(safe-area-inset-top, 0px)' : '';
      drawerEl.style.maxHeight = keyboardVisible ? `${window.innerHeight - offset}px` : '';
      if (footerEl) footerEl.style.paddingBottom = keyboardVisible ? '0.75rem' : '';
      if (scrollEl) scrollEl.style.paddingBottom = keyboardVisible ? '1rem' : '';
      if (keyboardVisible && !wasKeyboardVisible) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
      wasKeyboardVisible = keyboardVisible;
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    cleanupViewport = () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
      drawerEl.style.bottom = '';
      drawerEl.style.top = '';
      drawerEl.style.maxHeight = '';
      const footerEl = footerRef.value;
      const scrollEl = scrollContainerRef.value;
      if (footerEl) footerEl.style.paddingBottom = '';
      if (scrollEl) scrollEl.style.paddingBottom = '';
    };
    onResize();
  }

  function cleanupKeyboardListener() {
    cleanupViewport?.();
    cleanupViewport = null;
  }

  onBeforeUnmount(() => {
    cleanupKeyboardListener();
  });

  return { setupKeyboardListener, cleanupKeyboardListener };
}
