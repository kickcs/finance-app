import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useJustifiedRows } from './useJustifiedRows';

// jsdom не считает вёрстку: ширины текста нулевые, а `ResizeObserver` в
// `src/test/setup.ts` — пустышка. Поэтому измеритель подменён, ширина
// контейнера задаётся вручную, а пересчёт запускается через `measure()`.
vi.mock('@/shared/lib/layout/measureTextWidth', () => ({
  measureTextWidth: (text: string) => text.length * 10,
  resolveFont: () => '400 14px Inter',
}));

interface Item {
  name: string;
}

function mountHarness(names: string[]) {
  const items: Ref<Item[]> = ref(names.map((name) => ({ name })));

  const Harness = defineComponent({
    setup() {
      const { containerRef, rows, measure } = useJustifiedRows(items, (item) => item.name, {
        gap: 6,
        chromeFallback: 40,
      });
      return { containerRef, rows, measure };
    },
    render() {
      return h(
        'div',
        { ref: 'containerRef' },
        this.rows.map((row, rowIndex) =>
          h(
            'div',
            { class: 'row', key: rowIndex },
            row.map((chip) => h('button', { key: chip.item.name }, chip.item.name)),
          ),
        ),
      );
    },
  });

  const wrapper = mount(Harness, { attachTo: document.body });
  return {
    wrapper,
    items,
    setWidth(width: number) {
      Object.defineProperty(wrapper.element, 'clientWidth', {
        value: width,
        configurable: true,
      });
      wrapper.vm.measure();
      return nextTick();
    },
  };
}

describe('useJustifiedRows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('до замера контейнера отдаёт один ряд со всеми элементами', () => {
    const { wrapper } = mountHarness(['аб', 'вг', 'де']);
    expect(wrapper.vm.rows).toHaveLength(1);
    expect(wrapper.vm.rows[0]).toHaveLength(3);
  });

  it('раскладывает по рядам, когда ширина контейнера известна', async () => {
    // Каждый чип: 4 знака × 10 + хром 40 = 80. В 180 px влезают два (80+6+80=166).
    const { wrapper, setWidth } = mountHarness(['аааа', 'бббб', 'вввв', 'гггг']);
    await setWidth(180);

    expect(wrapper.vm.rows).toHaveLength(2);
    expect(wrapper.vm.rows.map((row) => row.length)).toEqual([2, 2]);
  });

  it('сохраняет порядок элементов при раскладке', async () => {
    const { wrapper, setWidth } = mountHarness(['аааа', 'бббб', 'вввв', 'гггг', 'дддд']);
    await setWidth(180);

    expect(wrapper.vm.rows.flat().map((chip) => chip.item.name)).toEqual([
      'аааа',
      'бббб',
      'вввв',
      'гггг',
      'дддд',
    ]);
  });

  it('отдаёт предел роста для каждого чипа', async () => {
    const { wrapper, setWidth } = mountHarness(['аб']);
    await setWidth(200);

    // натуральная 2×10 + хром 40 = 60, допуск роста по умолчанию 96
    expect(wrapper.vm.rows[0][0].maxWidth).toBe(156);
  });

  it('пересчитывает раскладку при смене списка', async () => {
    const { wrapper, items, setWidth } = mountHarness(['аааа', 'бббб']);
    await setWidth(180);
    expect(wrapper.vm.rows).toHaveLength(1);

    items.value = [...items.value, { name: 'вввв' }, { name: 'гггг' }];
    await nextTick();
    expect(wrapper.vm.rows).toHaveLength(2);
  });
});
