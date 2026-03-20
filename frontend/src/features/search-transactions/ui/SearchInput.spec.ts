import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { renderWithProviders } from '@/test/test-utils';
import SearchInput from './SearchInput.vue';

// ---------------------------------------------------------------------------

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function render(props: { modelValue?: string; placeholder?: string } = {}) {
  currentWrapper = renderWithProviders(SearchInput, {
    props: {
      modelValue: props.modelValue ?? '',
      placeholder: props.placeholder,
    },
  });
  return currentWrapper;
}

// ---------------------------------------------------------------------------

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    currentWrapper?.unmount();
    currentWrapper = null;
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders an input element', () => {
      const wrapper = render();
      expect(wrapper.find('input').exists()).toBe(true);
    });

    it('renders default placeholder when none given', () => {
      const wrapper = render();
      const input = wrapper.find('input');
      expect(input.attributes('placeholder')).toContain('Поиск');
    });

    it('renders custom placeholder', () => {
      const wrapper = render({ placeholder: 'Найти транзакцию' });
      const input = wrapper.find('input');
      expect(input.attributes('placeholder')).toBe('Найти транзакцию');
    });

    it('reflects modelValue in input', () => {
      const wrapper = render({ modelValue: 'Продукты' });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Продукты');
    });
  });

  // -------------------------------------------------------------------------
  // Emit events
  // -------------------------------------------------------------------------
  describe('emits', () => {
    it('emits update:modelValue when user types', async () => {
      const wrapper = render({ modelValue: '' });
      const input = wrapper.find('input');
      await input.setValue('тест');
      await nextTick();

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    });

    it('emits update:modelValue with the typed value', async () => {
      const wrapper = render({ modelValue: '' });
      const input = wrapper.find('input');
      await input.setValue('Магазин');
      await nextTick();

      const emitted = wrapper.emitted('update:modelValue');
      expect(emitted).toBeTruthy();
      expect(emitted![emitted!.length - 1]).toContain('Магазин');
    });
  });
});
