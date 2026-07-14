import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryPicker from './CategoryPicker.vue';
import type { Category } from '@/entities/category';

vi.mock('@/shared/lib/haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

function makeCat(id: string): Category {
  return { id, name: `Кат-${id}`, icon: 'restaurant', color: '#f00', type: 'expense' };
}

const manyCategories = Array.from({ length: 12 }, (_, i) => makeCat(`c${i}`));
const fewCategories = Array.from({ length: 6 }, (_, i) => makeCat(`c${i}`));

function mountPicker(props: Partial<InstanceType<typeof CategoryPicker>['$props']> = {}) {
  return mount(CategoryPicker, {
    props: { categories: manyCategories, selectedId: '', ...props },
    global: { stubs: { CategoryPickerSheet: true } },
  });
}

function chipButtons(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper.findAll('button[role="radio"]');
}

describe('CategoryPicker', () => {
  it('при >9 категориях показывает 8 чипов и чип «Ещё N» со скрытым количеством', () => {
    const wrapper = mountPicker();
    expect(chipButtons(wrapper)).toHaveLength(8);
    // 12 категорий, 8 инлайн → скрыто 4
    expect(wrapper.text()).toContain('Ещё 4');
    expect(wrapper.find('button[aria-label="Все категории"]').exists()).toBe(true);
  });

  it('при ≤9 категориях показывает все чипы без чипа «Ещё N»', () => {
    const wrapper = mountPicker({ categories: fewCategories });
    expect(chipButtons(wrapper)).toHaveLength(6);
    expect(wrapper.text()).not.toContain('Ещё');
  });

  it('эмитит select по клику на чип', async () => {
    const wrapper = mountPicker();
    await chipButtons(wrapper)[0].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['c0']]);
  });

  it('пинит выбранную категорию первым чипом, если она не в топ-8', () => {
    const wrapper = mountPicker({ selectedId: 'c11' });
    const chips = chipButtons(wrapper);
    expect(chips[0].text()).toContain('Кат-c11');
    expect(chips[0].attributes('aria-checked')).toBe('true');
  });

  it('не рендерит пин для несуществующей категории', () => {
    const wrapper = mountPicker({ selectedId: 'deleted' });
    expect(chipButtons(wrapper)).toHaveLength(8);
  });

  it('без транзакций показывает первые 8 по isFrequent-fallback (порядок БД)', () => {
    const wrapper = mountPicker();
    const ids = chipButtons(wrapper).map((b) => b.text());
    expect(ids[0]).toContain('Кат-c0');
  });
});
