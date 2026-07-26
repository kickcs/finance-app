import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import type * as VueUse from '@vueuse/core';
import { mountComposable } from '@/test/test-utils';

// vi.mock поднимается наверх файла, поэтому источник состояния объявляем через
// vi.hoisted — иначе фабрика мока обратится к ещё не инициализированной переменной.
const { motionPreference } = vi.hoisted(() => ({
  motionPreference: { value: 'no-preference' as 'no-preference' | 'reduce' },
}));

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>();
  return { ...actual, usePreferredReducedMotion: () => motionPreference };
});

const { useCountUp } = await import('./useCountUp');

describe('useCountUp', () => {
  beforeEach(() => {
    motionPreference.value = 'no-preference';
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('стартует со значений геттеров без анимации', () => {
    const { result, wrapper } = mountComposable(() => useCountUp({ a: () => 100 }));

    expect(result.a.value).toBe(100);
    wrapper.unmount();
  });

  it('доводит значение до цели за duration', async () => {
    const source = ref(0);
    const { result, wrapper } = mountComposable(() =>
      useCountUp({ a: () => source.value }, { duration: 400 }),
    );

    source.value = 100;
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(result.a.value).toBe(100);
    wrapper.unmount();
  });

  it('в середине анимации значение между стартом и целью', async () => {
    const source = ref(0);
    const { result, wrapper } = mountComposable(() =>
      useCountUp({ a: () => source.value }, { duration: 400 }),
    );

    source.value = 100;
    await nextTick();
    await vi.advanceTimersByTimeAsync(100);

    expect(result.a.value).toBeGreaterThan(0);
    expect(result.a.value).toBeLessThan(100);
    wrapper.unmount();
  });

  it('заводит один rAF на несколько значений', async () => {
    const a = ref(0);
    const b = ref(0);
    const { wrapper } = mountComposable(() =>
      useCountUp({ a: () => a.value, b: () => b.value }, { duration: 400 }),
    );

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    a.value = 10;
    b.value = 20;
    await nextTick();

    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
    wrapper.unmount();
  });

  it('не запускает анимацию, когда значения не изменились', async () => {
    const source = ref(50);
    const { wrapper } = mountComposable(() => useCountUp({ a: () => source.value }));

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    source.value = 50;
    await nextTick();

    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
    wrapper.unmount();
  });

  it('при prefers-reduced-motion присваивает целевое значение мгновенно', async () => {
    motionPreference.value = 'reduce';
    const source = ref(0);
    const { result, wrapper } = mountComposable(() => useCountUp({ a: () => source.value }));

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    source.value = 100;
    await nextTick();

    expect(result.a.value).toBe(100);
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
    wrapper.unmount();
  });
});
