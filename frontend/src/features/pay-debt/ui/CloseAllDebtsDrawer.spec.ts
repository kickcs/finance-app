import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createTestQueryClient } from '@/test/test-utils';
import CloseAllDebtsDrawer from './CloseAllDebtsDrawer.vue';
import type { Debt } from '@/shared/api/database.types';
import { makeDebt } from '@/test/fixtures/debt';
import type { AccountWithBalances } from '@/entities/account';

const accounts = [{ id: 'acc-1', name: 'Карта' }] as unknown as AccountWithBalances[];

/**
 * `UOverlay` уводит содержимое в портал (vaul на мобиле, reka на десктопе) —
 * для юнит-теста самой шторки он подменяется сквозной заглушкой: проверяем
 * логику распределения и пресетов, а не работу портала.
 */
const OverlayStub = {
  name: 'UOverlay',
  props: ['modelValue', 'title', 'desktop', 'maxHeight', 'fill'],
  template: '<div><slot name="action" /><slot /><slot name="footer" /></div>',
};

const globalOptions = {
  stubs: {
    UOverlay: OverlayStub,
    AccountSelector: true,
    DebtPaymentFields: true,
    DebtProgressMeter: true,
  },
};

function mountDrawer(debts: Debt[], extraProps: Record<string, unknown> = {}) {
  return mount(CloseAllDebtsDrawer, {
    props: { modelValue: true, debts, personName: 'Алексей', accounts, ...extraProps },
    global: {
      ...globalOptions,
      plugins: [[VueQueryPlugin, { queryClient: createTestQueryClient() }]],
    },
  });
}

const rows = (w: ReturnType<typeof mountDrawer>) =>
  w.findAll('[data-testid="close-all-debt-row"]').map((r) => r.text());

describe('CloseAllDebtsDrawer', () => {
  const twoDebts = [
    makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, created_at: '2026-01-01' }),
    makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 20_000, created_at: '2026-02-01' }),
  ];

  it('по умолчанию заполняет сумму полным остатком и закрывает все долги', () => {
    const wrapper = mountDrawer(twoDebts);
    const text = rows(wrapper);
    expect(text).toHaveLength(2);
    expect(text.every((t) => t.includes('Закроется'))).toBe(true);
    expect(wrapper.text()).toContain('закроется 2 из 2');
  });

  describe('встречные долги', () => {
    const mutual = [
      makeDebt({
        id: 't',
        name: 'Мой долг',
        debt_type: 'taken',
        remaining_amount: 10_000,
        created_at: '2026-03-01',
      }),
      makeDebt({
        id: 'g1',
        name: 'Его долг 1',
        remaining_amount: 15_000,
        created_at: '2026-01-01',
      }),
      makeDebt({
        id: 'g2',
        name: 'Его долг 2',
        remaining_amount: 20_000,
        created_at: '2026-02-01',
      }),
    ];

    it('показывает остаток после зачёта и направление по перевесу', () => {
      const wrapper = mountDrawer(mutual);
      expect(wrapper.text()).toContain('вам должны · 3 долга');
      expect(wrapper.find('[data-testid="close-all-offset-note"]').exists()).toBe(true);
      expect(rows(wrapper)).toEqual([
        expect.stringContaining('Закроется'),
        expect.stringContaining('Закроется'),
        expect.stringContaining('Зачтётся'),
      ]);
    });

    it('частичная сумма ложится после зачёта, по FIFO', async () => {
      const wrapper = mountDrawer(mutual);
      // Остаток 25 000, половина — 12 500: g1 (15 000) гасится зачётом 10 000
      // и 5 000 платежа, g2 получает 7 500 из 20 000.
      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      const [first, second, third] = rows(wrapper);
      expect(first).toContain('Закроется');
      expect(second).toContain('Частично');
      expect(third).toContain('Зачтётся');
      expect(wrapper.text()).toContain('закроется 2 из 3');
    });

    it('равные встречные долги закрываются одним зачётом, без суммы платежа', () => {
      const wrapper = mountDrawer([
        makeDebt({
          id: 't',
          debt_type: 'taken',
          remaining_amount: 5_000,
          created_at: '2026-01-02',
        }),
        makeDebt({ id: 'g', remaining_amount: 5_000, created_at: '2026-01-01' }),
      ]);
      expect(rows(wrapper).every((t) => t.includes('Зачтётся'))).toBe(true);
      expect(wrapper.find('[data-testid="close-all-amount-input"]').exists()).toBe(false);
      const submit = wrapper.find('[data-testid="close-all-submit"]');
      expect(submit.text()).toContain('Зачесть все долги');
      expect(submit.attributes('disabled')).toBeUndefined();
    });
  });

  it('распределяет частичную сумму по FIFO — старый долг первым', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');

    // Половина от 30 000 = 15 000: первый долг закрыт, второму достаётся 5 000
    const [first, second] = rows(wrapper);
    expect(first).toContain('Закроется');
    expect(second).toContain('Частично');
    expect(wrapper.text()).toContain('закроется 1 из 2');
  });

  it('«Простить» обнуляет сумму и помечает все долги как прощаемые', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');

    expect(rows(wrapper).every((t) => t.includes('Простится'))).toBe(true);
    expect(wrapper.find('[data-testid="close-all-submit"]').text()).toContain('Простить все долги');
  });

  it('частично оплаченный долг с прощением остатка не выдаётся за полностью прощённый', async () => {
    const wrapper = mountDrawer(twoDebts);
    // «Простить» включает прощение остатка, поверх набираем неполную сумму.
    await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
    const input = wrapper.find<HTMLInputElement>('[data-testid="close-all-amount-input"]');
    input.element.value = '15000';
    await input.trigger('input');

    // 15 000: первый долг (10 000) закрыт деньгами, второму достаётся 5 000
    // деньгами и 15 000 прощением — это не «Простится».
    const [first, second] = rows(wrapper);
    expect(first).toContain('Закроется');
    expect(second).toContain('Часть + прощение');
    expect(second).not.toContain('Простится');
    // Оба долга всё равно уходят из списка.
    expect(wrapper.text()).toContain('закроется 2 из 2');
  });

  it('отдаёт выбранный счёт и параметры платежа наружу', async () => {
    const wrapper = mountDrawer(twoDebts);
    await wrapper.find('[data-testid="close-all-submit"]').trigger('click');

    expect(wrapper.emitted('confirm')?.[0]).toEqual([
      'acc-1',
      { paymentAmount: 30_000, forgiveRemainder: false, excessCategoryId: undefined },
    ]);
  });

  it('при разных валютах прячет ввод суммы и показывает итог по каждой валюте', () => {
    const wrapper = mountDrawer([
      makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, currency: 'UZS' }),
      makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 100, currency: 'USD' }),
    ]);

    expect(wrapper.find('[data-testid="close-all-amount-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="close-all-preset-half"]').exists()).toBe(false);
  });

  it('пока идёт закрытие, кнопка заблокирована и показывает прогресс', () => {
    const wrapper = mountDrawer(twoDebts, { isClosing: true, progress: 1, total: 2 });

    const submit = wrapper.find('[data-testid="close-all-submit"]');
    expect(submit.text()).toContain('Закрываем 1 из 2');
    expect(submit.attributes('disabled')).toBeDefined();
  });
});
