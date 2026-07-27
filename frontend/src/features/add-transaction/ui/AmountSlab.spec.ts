import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { renderWithProviders } from '@/test/test-utils';
import AmountSlab from './AmountSlab.vue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SlabProps = {
  amount?: number;
  currency?: string;
  currencySymbol?: string;
  availableCurrencies?: string[];
  isMultiCurrency?: boolean;
  type?: 'expense' | 'income' | 'transfer' | 'debt';
  sign?: 'minus' | 'plus' | null;
  currentBalance?: number;
  showInsufficientFunds?: boolean;
};

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function render(props: SlabProps = {}) {
  currentWrapper = renderWithProviders(AmountSlab, {
    props: {
      amount: 0,
      currency: 'UZS',
      currencySymbol: 'сўм',
      availableCurrencies: ['UZS'],
      isMultiCurrency: false,
      type: 'expense',
      sign: 'minus',
      ...props,
    },
  });
  return currentWrapper;
}

function amountInput(wrapper: ReturnType<typeof renderWithProviders>) {
  return wrapper.find('[data-testid="amount-input"]');
}

// ---------------------------------------------------------------------------

describe('AmountSlab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    currentWrapper?.unmount();
    currentWrapper = null;
  });

  describe('ввод суммы', () => {
    it('печатает сумму с разделителями разрядов', () => {
      const wrapper = render({ amount: 3068000 });
      expect(wrapper.text()).toContain('3 068 000');
    });

    it('показывает ноль, пока сумму не ввели', () => {
      const wrapper = render({ amount: 0 });
      expect(wrapper.text()).toContain('0');
    });

    it('сообщает введённую сумму наверх', async () => {
      const wrapper = render();

      await amountInput(wrapper).setValue('2500');

      expect(wrapper.emitted('update:amount')?.at(-1)).toEqual([2500]);
    });

    it('отбрасывает нечисловой ввод', async () => {
      const wrapper = render();

      await amountInput(wrapper).setValue('12abc3');

      expect(wrapper.emitted('update:amount')?.at(-1)).toEqual([123]);
    });
  });

  describe('кегль суммы', () => {
    // В UZS суммы длинные, и на фиксированном кегле упираются в края плиты
    it('уменьшает кегль по мере роста числа', () => {
      const short = render({ amount: 250000 });
      const shortClass = short.find('.slab-amount').classes().join(' ');
      short.unmount();

      const long = render({ amount: 123456789 });
      const longClass = long.find('.slab-amount').classes().join(' ');

      expect(shortClass).toContain('text-[2.75rem]');
      expect(longClass).toContain('text-3xl');
    });
  });

  describe('строка баланса', () => {
    it('показывает текущий баланс, пока сумма не введена', () => {
      const wrapper = render({ amount: 0, currentBalance: 500000 });
      expect(wrapper.text()).toContain('Баланс');
    });

    it('показывает остаток после списания', () => {
      const wrapper = render({ amount: 100000, currentBalance: 500000, sign: 'minus' });
      expect(wrapper.text()).toContain('Останется');
    });

    it('показывает будущий баланс для зачисления', () => {
      const wrapper = render({ amount: 100000, currentBalance: 500000, sign: 'plus' });
      expect(wrapper.text()).toContain('Станет');
    });

    it('называет нехватку и озвучивает её скринридеру', () => {
      const wrapper = render({
        amount: 900000,
        currentBalance: 500000,
        showInsufficientFunds: true,
      });

      expect(wrapper.text()).toContain('Не хватает');
      expect(wrapper.find('[role="status"]').attributes('aria-live')).toBe('polite');
    });

    it('молчит, когда счёт ещё не выбран', () => {
      const wrapper = render({ amount: 1000, currentBalance: undefined });
      expect(wrapper.text()).not.toContain('Баланс');
    });
  });

  describe('доля траты', () => {
    it('заполняет полоску пропорционально балансу', () => {
      const wrapper = render({ amount: 250000, currentBalance: 1000000, sign: 'minus' });

      expect(wrapper.find('.slab-share').attributes('style')).toContain('width: 25%');
    });

    it('упирается в сто процентов, когда трата больше баланса', () => {
      const wrapper = render({ amount: 5000000, currentBalance: 1000000, sign: 'minus' });

      expect(wrapper.find('.slab-share').attributes('style')).toContain('width: 100%');
    });

    it('не рисует полоску для зачисления — делить нечего', () => {
      const wrapper = render({ amount: 250000, currentBalance: 1000000, sign: 'plus' });

      expect(wrapper.find('.slab-share').exists()).toBe(false);
    });
  });

  describe('сегменты типа', () => {
    it('помечает активный сегмент', () => {
      const wrapper = render({ type: 'income' });

      expect(wrapper.find('[data-testid="type-income"]').attributes('aria-pressed')).toBe('true');
      expect(wrapper.find('[data-testid="type-expense"]').attributes('aria-pressed')).toBe('false');
    });

    it('сообщает выбранный тип наверх', async () => {
      const wrapper = render({ type: 'expense' });

      await wrapper.find('[data-testid="type-transfer"]').trigger('click');

      expect(wrapper.emitted('update:type')?.at(-1)).toEqual(['transfer']);
    });

    it('молчит при тапе по уже активному сегменту', async () => {
      const wrapper = render({ type: 'expense' });

      await wrapper.find('[data-testid="type-expense"]').trigger('click');

      expect(wrapper.emitted('update:type')).toBeUndefined();
    });
  });

  describe('навигация', () => {
    it('просит увести назад', async () => {
      const wrapper = render();

      await wrapper.find('[aria-label="Назад"]').trigger('click');

      expect(wrapper.emitted('back')).toHaveLength(1);
    });
  });

  describe('валюта', () => {
    it('печатает символ валюты без выбора, когда она одна', () => {
      const wrapper = render({ isMultiCurrency: false, currencySymbol: 'сўм' });

      expect(wrapper.text()).toContain('сўм');
      expect(wrapper.find('[aria-label="Выбрать валюту"]').exists()).toBe(false);
    });

    it('даёт выбрать валюту на мультивалютном счёте', async () => {
      const wrapper = render({ isMultiCurrency: true, availableCurrencies: ['UZS', 'USD'] });
      await nextTick();

      expect(wrapper.find('[aria-label="Выбрать валюту"]').exists()).toBe(true);
    });
  });
});
