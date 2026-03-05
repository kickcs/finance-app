/**
 * Composable for programmatically opening the mobile keyboard before async navigation.
 *
 * Mobile browsers block focus() calls outside the synchronous user gesture chain.
 * Call `trigger()` synchronously inside a click/tap handler to open the keyboard,
 * then navigate — the target input's focus() will keep the keyboard open.
 *
 * The temporary input auto-removes itself when it loses focus (i.e. the real input takes over).
 */
export function useKeyboardTrigger() {
  let activeInput: HTMLInputElement | null = null;

  function trigger(inputMode: string = 'numeric') {
    // Reuse existing trigger input if still in DOM
    if (activeInput?.isConnected) {
      activeInput.focus();
      return;
    }

    const el = document.createElement('input');
    el.inputMode = inputMode;
    el.style.cssText =
      'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;pointer-events:none';
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    document.body.appendChild(el);
    el.focus();

    activeInput = el;

    el.addEventListener(
      'blur',
      () => {
        el.remove();
        activeInput = null;
      },
      { once: true },
    );
  }

  return { trigger };
}
