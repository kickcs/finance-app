import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

type Listener = (e: { matches: boolean }) => void;

let listeners: Listener[] = [];
let currentMatches = false;

function installMatchMedia() {
  listeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: currentMatches,
    media: query,
    addEventListener: (_: string, cb: Listener) => listeners.push(cb),
    removeEventListener: (_: string, cb: Listener) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  }));
}

function emitChange(matches: boolean) {
  currentMatches = matches;
  listeners.forEach((cb) => cb({ matches }));
}

describe('useIsDesktop', () => {
  beforeEach(() => {
    currentMatches = false;
    installMatchMedia();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('порог равен 1024 пикселям', async () => {
    const { DESKTOP_MIN_WIDTH } = await import('./useIsDesktop');
    expect(DESKTOP_MIN_WIDTH).toBe(1024);
  });

  it('переживает размонтирование компонента, который вызвал его первым', async () => {
    const { useIsDesktop } = await import('./useIsDesktop');

    const First = defineComponent({
      setup() {
        useIsDesktop();
        return () => h('div');
      },
    });

    const first = mount(First);
    first.unmount();

    const isDesktop = useIsDesktop();
    emitChange(true);
    await nextTick();

    expect(isDesktop.value).toBe(true);
  });

  it('setIsDesktopForTests подменяет значение и снимается через null', async () => {
    const { useIsDesktop, setIsDesktopForTests } = await import('./useIsDesktop');

    setIsDesktopForTests(true);
    expect(useIsDesktop().value).toBe(true);

    setIsDesktopForTests(false);
    expect(useIsDesktop().value).toBe(false);

    setIsDesktopForTests(null);
    expect(useIsDesktop().value).toBe(false);
  });
});
