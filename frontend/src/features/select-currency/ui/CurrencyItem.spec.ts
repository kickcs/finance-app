import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { renderWithProviders } from '@/test/test-utils';
import CurrencyItem from './CurrencyItem.vue';
import { CURRENCIES } from '@/entities/currency';

// ---------------------------------------------------------------------------

const usd = CURRENCIES.find((c) => c.code === 'USD')!;
const uzs = CURRENCIES.find((c) => c.code === 'UZS')!;

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function render(props: { currency?: typeof usd; selected?: boolean } = {}) {
  currentWrapper = renderWithProviders(CurrencyItem, {
    props: {
      currency: props.currency ?? usd,
      selected: props.selected ?? false,
    },
  });
  return currentWrapper;
}

// ---------------------------------------------------------------------------

describe('CurrencyItem', () => {
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
    it('renders currency code', () => {
      const wrapper = render({ currency: usd });
      expect(wrapper.text()).toContain('USD');
    });

    it('renders currency name', () => {
      const wrapper = render({ currency: usd });
      expect(wrapper.text()).toContain('US Dollar');
    });

    it('renders currency symbol', () => {
      const wrapper = render({ currency: usd });
      expect(wrapper.text()).toContain('$');
    });

    it('renders flag emoji', () => {
      const wrapper = render({ currency: usd });
      expect(wrapper.text()).toContain(usd.flag);
    });

    it('renders UZS currency correctly', () => {
      const wrapper = render({ currency: uzs });
      expect(wrapper.text()).toContain('UZS');
      expect(wrapper.text()).toContain('Uzbekistani Som');
    });
  });

  // -------------------------------------------------------------------------
  // Selected state
  // -------------------------------------------------------------------------
  describe('selected state', () => {
    it('shows checkmark when selected is true', () => {
      const wrapper = render({ selected: true });
      // Check ring class applied to root button
      const button = wrapper.find('button');
      expect(button.classes().join(' ')).toContain('ring-2');
    });

    it('does not show ring when not selected', () => {
      const wrapper = render({ selected: false });
      const button = wrapper.find('button');
      expect(button.classes().join(' ')).not.toContain('ring-2');
    });

    it('shows checkmark icon when selected', () => {
      const wrapper = render({ selected: true });
      // The check div is rendered inside v-if="selected"
      const checkContainer = wrapper.find('.bg-primary.rounded-full');
      expect(checkContainer.exists()).toBe(true);
    });

    it('does not show checkmark when not selected', () => {
      const wrapper = render({ selected: false });
      const checkContainer = wrapper.find('.bg-primary.rounded-full');
      expect(checkContainer.exists()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Emit events
  // -------------------------------------------------------------------------
  describe('emits', () => {
    it('emits select when button is clicked', async () => {
      const wrapper = render({ currency: usd });
      await wrapper.find('[data-testid="currency-item-USD"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('select')).toBeTruthy();
    });

    it('emits select for selected currency too', async () => {
      const wrapper = render({ currency: usd, selected: true });
      await wrapper.find('[data-testid="currency-item-USD"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('select')).toBeTruthy();
    });

    it('emits select multiple times on multiple clicks', async () => {
      const wrapper = render({ currency: usd });
      await wrapper.find('[data-testid="currency-item-USD"]').trigger('click');
      await wrapper.find('[data-testid="currency-item-USD"]').trigger('click');
      await nextTick();

      expect(wrapper.emitted('select')?.length).toBe(2);
    });
  });
});
