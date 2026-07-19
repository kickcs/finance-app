import { onBeforeUnmount, type Ref } from 'vue';

/**
 * Computes the drawer's bottom offset from visualViewport geometry.
 * `offsetTop` accounts for hosts (e.g. Telegram iOS) that already pan the
 * viewport up themselves — only the uncovered part of the keyboard is offset.
 */
export function computeKeyboardGeometry(
  innerHeight: number,
  viewportHeight: number,
  offsetTop: number,
): { keyboardVisible: boolean; offset: number } {
  const raw = innerHeight - viewportHeight;
  return { keyboardVisible: raw > 0, offset: Math.max(0, raw - offsetTop) };
}

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
      const { keyboardVisible, offset } = computeKeyboardGeometry(
        window.innerHeight,
        vv.height,
        vv.offsetTop,
      );
      drawerEl.style.bottom = keyboardVisible ? `${offset}px` : '';
      // top учитывает пан вьюпорта (Telegram iOS): видимая область начинается
      // с vv.offsetTop, иначе top+bottom over-constrained и шторка уезжает вверх.
      drawerEl.style.top = keyboardVisible
        ? `calc(env(safe-area-inset-top, 0px) + ${vv.offsetTop}px)`
        : '';
      // vv.height — реально видимая высота (не innerHeight - offset, который
      // при пане завышен на offsetTop).
      drawerEl.style.maxHeight = keyboardVisible ? `${vv.height}px` : '';
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
      const el = (drawerContentRef.value?.$el as HTMLElement | undefined) ?? drawerEl;
      el.style.bottom = '';
      el.style.top = '';
      el.style.maxHeight = '';
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
