import { describe, it, expect, vi } from 'vitest';
import DebtPanel from './DebtPanel.vue';
import { renderWithProviders } from '@/test/test-utils';
import type { AccountWithBalances } from '@/entities/account';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));
vi.mock('@/shared/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ userId: { value: 'u1' } }),
}));
vi.mock('@/entities/person', () => ({
  PersonSelector: { template: '<div data-testid="person-selector" />' },
  usePeople: () => ({ people: { value: [] }, createPerson: vi.fn() }),
}));

const accounts = [
  {
    id: 'a1',
    name: 'Основной',
    color: '#3b82f6',
    balances: [{ currency: 'UZS', balance: 1_000_000 }],
  },
] as unknown as AccountWithBalances[];

function mountPanel(amount = 98_000) {
  return renderWithProviders(DebtPanel, {
    props: { amount, currency: 'UZS', accountId: 'a1', accounts },
    global: {
      stubs: {
        // Триггер лежит в слоте поповера — без раскрытия слота строки счёта
        // в разметке не будет.
        AccountPopover: { template: '<div><slot name="trigger" /></div>' },
        DatePickerField: true,
        ToggleRow: true,
      },
    },
  });
}

/** Модель стартует с `debt_type: 'taken'` — комиссию платит только отправитель. */
function switchToGiven(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('[role="tab"]')[0].trigger('click');
}

describe('DebtPanel', () => {
  it('человек, счёт и дата лежат в одном списке', () => {
    const list = mountPanel().find('[data-testid="debt-fields"]');
    expect(list.exists()).toBe(true);
    expect(list.findAll('[data-testid^="debt-row-"]')).toHaveLength(3);
  });

  it('комиссия скрыта, пока «Ещё» свёрнуто', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('комиссия появляется в раскрытом «Ещё» при выдаче долга', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(true);
  });

  it('комиссии нет, когда долг взят: её платит отправитель', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('итог — одна строка, а не блок с заливкой', () => {
    const summary = mountPanel().find('[data-testid="debt-summary"]');
    expect(summary.exists()).toBe(true);
    expect(summary.text()).toContain('Добавится');
    expect(summary.text()).toContain('Основной');
  });

  it('итог меняет глагол при выдаче долга', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.find('[data-testid="debt-summary"]').text()).toContain('Спишется');
  });

  it('без суммы итоговой строки нет', () => {
    expect(mountPanel(0).find('[data-testid="debt-summary"]').exists()).toBe(false);
  });
});
