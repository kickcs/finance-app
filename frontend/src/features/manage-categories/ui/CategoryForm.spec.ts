import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { server } from '@/test/mocks/server';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import CategoryForm from './CategoryForm.vue';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../model/constants';

// ---------------------------------------------------------------------------

const defaultFormData = {
  name: '',
  icon: CATEGORY_ICONS[0],
  color: CATEGORY_COLORS[0],
  type: 'expense' as const,
};

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function render(formData = defaultFormData, nameError: string | null = null) {
  currentWrapper = renderWithProviders(CategoryForm, {
    props: { formData, nameError },
    provideAuth: { user: mockUser },
  });
  return currentWrapper;
}

// ---------------------------------------------------------------------------

describe('CategoryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    void flushPromises();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders name input with label', () => {
      const wrapper = render();
      expect(wrapper.text()).toContain('Название');
    });

    it('renders color picker with label', () => {
      const wrapper = render();
      expect(wrapper.text()).toContain('Цвет');
    });

    it('renders icon selector with label', () => {
      const wrapper = render();
      expect(wrapper.text()).toContain('Иконка');
    });

    it('shows current name value in input', () => {
      const wrapper = render({ ...defaultFormData, name: 'Продукты' });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Продукты');
    });

    it('shows name error when provided', () => {
      const wrapper = render(defaultFormData, 'Название не может состоять только из пробелов');
      expect(wrapper.text()).toContain('Название не может состоять только из пробелов');
    });

    it('does not show error when nameError is null', () => {
      const wrapper = render(defaultFormData, null);
      expect(wrapper.text()).not.toContain('состоять только из пробелов');
    });
  });

  // -------------------------------------------------------------------------
  // Emit events
  // -------------------------------------------------------------------------
  describe('emits', () => {
    it('emits update:name when input changes', async () => {
      const wrapper = render();
      const input = wrapper.find('input');
      await input.setValue('Транспорт');
      await nextTick();

      expect(wrapper.emitted('update:name')).toBeTruthy();
      expect(wrapper.emitted('update:name')![0]).toEqual(['Транспорт']);
    });

    it('emits update:name with raw value (trimming by composable)', async () => {
      const wrapper = render();
      const input = wrapper.find('input');
      await input.setValue('  Здоровье  ');
      await nextTick();

      const emitted = wrapper.emitted('update:name');
      expect(emitted).toBeTruthy();
      expect(emitted![emitted!.length - 1]).toEqual(['  Здоровье  ']);
    });
  });
});
