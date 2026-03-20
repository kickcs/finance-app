import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { renderWithProviders } from '@/test/test-utils';
import FilterChips from './FilterChips.vue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const items = [
  { id: 'groceries', name: 'Продукты', icon: 'shopping_basket', color: '#10b981' },
  { id: 'transport', name: 'Транспорт', icon: 'directions_car', color: '#3b82f6' },
  { id: 'health', name: 'Здоровье', icon: 'cardiology', color: '#f43f5e' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function render(props: { items?: typeof items; selectedIds?: string[]; label?: string }) {
  currentWrapper = renderWithProviders(FilterChips, {
    props: {
      items: props.items ?? items,
      selectedIds: props.selectedIds ?? [],
      label: props.label,
    },
  });
  return currentWrapper;
}

// ---------------------------------------------------------------------------

describe('FilterChips', () => {
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
    it('renders all chip buttons', () => {
      const wrapper = render({});
      const buttons = wrapper.findAll('button');
      expect(buttons.length).toBe(3);
      expect(wrapper.text()).toContain('Продукты');
      expect(wrapper.text()).toContain('Транспорт');
      expect(wrapper.text()).toContain('Здоровье');
    });

    it('shows label when provided', () => {
      const wrapper = render({ label: 'Категории' });
      expect(wrapper.text()).toContain('Категории');
    });

    it('does not show label when not provided', () => {
      const wrapper = render({});
      // No label div rendered
      expect(wrapper.find('.justify-between').exists()).toBe(false);
    });

    it('renders color dot for chips with color', () => {
      const wrapper = render({});
      // Each item has a color so each chip should have a color dot span
      const colorDots = wrapper.findAll('span[style]');
      expect(colorDots.length).toBeGreaterThan(0);
    });

    it('renders empty list without errors', () => {
      const wrapper = render({ items: [] });
      expect(wrapper.findAll('button').length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Selected state
  // -------------------------------------------------------------------------
  describe('selected state', () => {
    it('applies selected styles when chip is in selectedIds', () => {
      const wrapper = render({ selectedIds: ['groceries'] });
      const buttons = wrapper.findAll('button');
      const groceriesBtn = buttons.find((b) => b.text().includes('Продукты'));
      expect(groceriesBtn?.classes()).toContain('bg-primary');
    });

    it('does not apply selected styles when chip is not selected', () => {
      const wrapper = render({ selectedIds: ['groceries'] });
      const buttons = wrapper.findAll('button');
      const transportBtn = buttons.find((b) => b.text().includes('Транспорт'));
      expect(transportBtn?.classes()).not.toContain('bg-primary');
    });

    it('shows count badge when selectedIds is non-empty and label present', () => {
      const wrapper = render({ selectedIds: ['groceries', 'transport'], label: 'Категории' });
      expect(wrapper.text()).toContain('(2)');
    });

    it('does not show count badge when no items selected', () => {
      const wrapper = render({ selectedIds: [], label: 'Категории' });
      expect(wrapper.text()).not.toContain('(');
    });

    it('shows Сбросить button when selectedIds is non-empty and label present', () => {
      const wrapper = render({ selectedIds: ['groceries'], label: 'Категории' });
      const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Сбросить'));
      expect(resetBtn?.exists()).toBe(true);
    });

    it('does not show Сбросить when no selectedIds', () => {
      const wrapper = render({ selectedIds: [], label: 'Категории' });
      const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('Сбросить'));
      expect(resetBtn).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Toggle events
  // -------------------------------------------------------------------------
  describe('toggle events', () => {
    it('emits toggle with id when chip is clicked', async () => {
      const wrapper = render({});
      await wrapper.find('[data-testid="filter-chip-groceries"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('toggle')).toBeTruthy();
      expect(wrapper.emitted('toggle')![0]).toEqual(['groceries']);
    });

    it('emits toggle for each separate chip click', async () => {
      const wrapper = render({});
      await wrapper.find('[data-testid="filter-chip-groceries"]').trigger('click');
      await wrapper.find('[data-testid="filter-chip-transport"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('toggle')?.length).toBe(2);
      expect(wrapper.emitted('toggle')![0]).toEqual(['groceries']);
      expect(wrapper.emitted('toggle')![1]).toEqual(['transport']);
    });

    it('emits toggle when clicking an already-selected chip (toggle off)', async () => {
      const wrapper = render({ selectedIds: ['groceries'] });
      await wrapper.find('[data-testid="filter-chip-groceries"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('toggle')).toBeTruthy();
      expect(wrapper.emitted('toggle')![0]).toEqual(['groceries']);
    });

    it('emits clear when Сбросить is clicked', async () => {
      const wrapper = render({ selectedIds: ['groceries'], label: 'Категории' });
      const resetBtn = wrapper.find('[data-testid="filter-chips-clear"]');
      await resetBtn?.trigger('click');
      await nextTick();

      expect(wrapper.emitted('clear')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles rapid toggle clicks without crashing', async () => {
      const wrapper = render({});
      const btn = wrapper.find('[data-testid="filter-chip-groceries"]');
      for (let i = 0; i < 5; i++) {
        await btn.trigger('click');
      }
      await nextTick();
      expect(wrapper.emitted('toggle')?.length).toBe(5);
    });

    it('renders chip without color when color is not provided', () => {
      const noColorItems = [{ id: 'plain', name: 'Без цвета', icon: '', color: '' }];
      const wrapper = render({ items: noColorItems });
      // No style attribute span for color dot
      expect(wrapper.findAll('span[style]').length).toBe(0);
      expect(wrapper.text()).toContain('Без цвета');
    });

    it('all chips selected shows selected styles on each', () => {
      const wrapper = render({ selectedIds: ['groceries', 'transport', 'health'] });
      const buttons = wrapper.findAll('button');
      buttons.forEach((btn) => {
        expect(btn.classes()).toContain('bg-primary');
      });
    });
  });
});
