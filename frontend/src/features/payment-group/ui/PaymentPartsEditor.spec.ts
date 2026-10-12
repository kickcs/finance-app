import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AccountWithBalances } from '@/entities/account';
import PaymentPartsEditor from './PaymentPartsEditor.vue';
import type { SecondPart } from '../model/paymentParts';

function makeAccount(id: string, name: string, balance: number): AccountWithBalances {
  return {
    id,
    user_id: 'user-1',
    name,
    type: 'basic',
    icon: 'credit_card',
    color: '#3b82f6',
    created_at: '2025-01-01T00:00:00.000Z',
    balances: [
      { id: `${id}-uzs`, account_id: id, currency: 'UZS', balance, created_at: '2025-01-01' },
    ],
  } as AccountWithBalances;
}

const UZCARD = makeAccount('acc-1', 'Uzcard', 500000);
const CASH = makeAccount('acc-2', 'Наличные', 30000);

// Поповер выбора счёта рендерит только триггер; выбор эмулируем событием `select`.
const AccountPopoverStub = {
  name: 'AccountPopover',
  props: ['accounts', 'selectedId'],
  emits: ['select'],
  template: '<div><slot name="trigger" /></div>',
};

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(PaymentPartsEditor, {
    props: {
      modelValue: null,
      accounts: [UZCARD, CASH],
      primaryAccountId: 'acc-1',
      currency: 'UZS',
      total: 100000,
      ...props,
    },
    global: { stubs: { UIcon: true, AccountPopover: AccountPopoverStub } },
  });
}

const text = (w: ReturnType<typeof mountEditor>, testId: string) =>
  w.get(`[data-testid="${testId}"]`).text().replace(/\s+/g, ' ');

const lastPart = (w: ReturnType<typeof mountEditor>) =>
  w.emitted('update:modelValue')!.at(-1)![0] as SecondPart | null;

describe('PaymentPartsEditor', () => {
  it('включает вторую часть и сразу подставляет единственный подходящий счёт', async () => {
    const wrapper = mountEditor();
    await wrapper.get('[data-testid="add-second-part"]').trigger('click');
    expect(lastPart(wrapper)).toEqual({ accountId: 'acc-2', amount: 0 });
  });

  it('не предлагает второй счёт, когда других счетов нет', () => {
    const wrapper = mountEditor({ accounts: [UZCARD] });
    expect(wrapper.find('[data-testid="add-second-part"]').exists()).toBe(false);
  });

  it('не предлагает второй счёт, пока не выбран первый', () => {
    const wrapper = mountEditor({ primaryAccountId: null });
    expect(wrapper.find('[data-testid="add-second-part"]').exists()).toBe(false);
  });

  it('считает первую часть как итог минус вторая', () => {
    const wrapper = mountEditor({ modelValue: { accountId: 'acc-2', amount: 40000 } });
    expect(text(wrapper, 'primary-part-amount')).toBe('60 000');
  });

  it('передаёт введённую сумму второй части', async () => {
    const wrapper = mountEditor({ modelValue: { accountId: 'acc-2', amount: 0 } });
    await wrapper.get('[data-testid="second-part-amount"]').setValue('25000');
    expect(lastPart(wrapper)).toEqual({ accountId: 'acc-2', amount: 25000 });
  });

  it('убирает вторую часть кнопкой «Убрать второй счёт»', async () => {
    const wrapper = mountEditor({ modelValue: { accountId: 'acc-2', amount: 40000 } });
    const remove = wrapper.get('[data-testid="remove-second-part"]');
    expect(remove.attributes('aria-label')).toBe('Убрать второй счёт');
    await remove.trigger('click');
    expect(lastPart(wrapper)).toBeNull();
  });

  it('показывает «Не хватает» под частью, которая больше баланса счёта', () => {
    const wrapper = mountEditor({
      modelValue: { accountId: 'acc-2', amount: 40000 },
      sign: 'minus',
    });
    expect(text(wrapper, 'second-part-note')).toMatch(/^Не хватает 10 000/);
    expect(text(wrapper, 'primary-part-note')).toMatch(/^Останется 440 000/);
  });

  it('просит выбрать счёт, пока из нескольких не выбран ни один', async () => {
    const third = makeAccount('acc-3', 'Накопления', 900000);
    const wrapper = mountEditor({
      accounts: [UZCARD, CASH, third],
      modelValue: { accountId: null, amount: 0 },
    });
    expect(text(wrapper, 'second-account-trigger')).toContain('Выберите счёт');

    wrapper.findComponent({ name: 'AccountPopover' }).vm.$emit('select', 'acc-3');
    expect(lastPart(wrapper)).toEqual({ accountId: 'acc-3', amount: 0 });
  });

  it('молчит об ошибке, пока пользователь ничего не ввёл', async () => {
    const wrapper = mountEditor({ modelValue: { accountId: 'acc-2', amount: 0 } });
    expect(wrapper.find('[data-testid="second-part-error"]').exists()).toBe(false);

    await wrapper.get('[data-testid="second-part-amount"]').trigger('blur');
    expect(text(wrapper, 'second-part-error')).toBe('Введите сумму второй части');
  });

  describe('якорь primary (сумма из уведомления банка)', () => {
    it('держит первую часть и наращивает итог второй', async () => {
      const wrapper = mountEditor({
        anchor: 'primary',
        primaryFixed: 60000,
        total: 60000,
        modelValue: { accountId: 'acc-2', amount: 0 },
      });
      expect(text(wrapper, 'primary-part-note')).toBe('из уведомления банка');

      await wrapper.get('[data-testid="second-part-amount"]').setValue('40000');
      expect(wrapper.emitted('update:total')!.at(-1)).toEqual([100000]);
      expect(text(wrapper, 'primary-part-amount')).toBe('60 000');
    });

    it('при снятии второй части возвращает итог к сумме банка', async () => {
      const wrapper = mountEditor({
        anchor: 'primary',
        primaryFixed: 60000,
        total: 100000,
        modelValue: { accountId: 'acc-2', amount: 40000 },
      });
      await wrapper.get('[data-testid="remove-second-part"]').trigger('click');
      expect(wrapper.emitted('update:total')!.at(-1)).toEqual([60000]);
    });
  });
});
