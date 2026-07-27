import { describe, it, expect, vi } from 'vitest';
import DebtPanel from './DebtPanel.vue';
import { renderWithProviders } from '@/test/test-utils';
import type { AccountWithBalances } from '@/entities/account';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));
vi.mock('@/shared/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ userId: { value: 'u1' } }),
}));
vi.mock('@/entities/person', () => ({
  PersonPicker: {
    // Имя нужно, чтобы тест мог достать заглушку через `findComponent` и
    // проверить пропы: у объявленного литералом компонента его нет.
    name: 'PersonPicker',
    template: `<div data-testid="person-picker" @click="$emit('select', 'Азиз')"><slot name="trailing" /></div>`,
    props: ['people', 'debts', 'selected', 'label', 'multiple', 'trailingLabel'],
    emits: ['select', 'create'],
  },
  usePeople: () => ({ people: { value: [] }, createPerson: vi.fn() }),
}));
vi.mock('@/entities/debt', () => ({ useDebts: () => ({ debts: { value: [] } }) }));

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
    global: { stubs: { DatePickerField: true, DueDateField: true, ToggleRow: true } },
  });
}

/** Модель стартует с `debt_type: 'taken'` — комиссию платит только отправитель. */
function switchToGiven(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('[role="tab"]')[0].trigger('click');
}

function openMore(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
}

describe('DebtPanel', () => {
  it('человека выбирают чипами, а не текстовым полем', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="person-picker"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="debt-fields"]').exists()).toBe(false);
  });

  it('счёт больше не выбирается внутри панели — он живёт на карточке суммы', () => {
    expect(mountPanel().find('[data-testid="debt-row-account"]').exists()).toBe(false);
  });

  it('дата замыкает ряд чипов, а не занимает свою строку', () => {
    const wrapper = mountPanel();
    const picker = wrapper.findComponent({ name: 'PersonPicker' });

    // Поле даты лежит в слоте пикера — значит, встаёт последней ячейкой ряда.
    expect(picker.findComponent({ name: 'DatePickerField' }).exists()).toBe(true);
    // Подпись для раскладки — сегодняшняя дата: модель стартует с `getTodayISO`.
    expect(picker.props('trailingLabel')).toBeTruthy();
  });

  it('не показывает строку-итог: прогноз остатка есть на карточке суммы', () => {
    expect(mountPanel().find('[data-testid="debt-summary"]').exists()).toBe(false);
  });

  it('кнопка сабмита лежит в липком подвале', () => {
    expect(mountPanel().find('.submit-bar [data-testid="debt-submit"]').exists()).toBe(true);
  });

  it('подсказывает, чего не хватает, пока кнопка заблокирована', () => {
    expect(mountPanel(0).find('[data-testid="debt-submit-hint"]').text()).toBe(
      'Укажите имя и сумму',
    );
  });

  it('подсказка исчезает, когда форма заполнена', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="person-picker"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-submit-hint"]').exists()).toBe(false);
  });

  it('сообщает наверх, что взятый долг пополняет счёт', () => {
    expect(mountPanel().emitted('balance-effect')?.at(-1)).toEqual([
      { sign: 'plus', extraDebit: 0 },
    ]);
  });

  it('сообщает наверх, что выданный долг списывает со счёта', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([{ sign: 'minus', extraDebit: 0 }]);
  });

  it('комиссии нет, когда долг взят: её платит отправитель', async () => {
    const wrapper = mountPanel();
    await openMore(wrapper);
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('комиссия скрыта, пока «Ещё» свёрнуто', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('комиссия появляется в раскрытом «Ещё» при выдаче долга', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    await openMore(wrapper);
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(true);
  });

  it('комиссия уходит наверх как дополнительное списание', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    await openMore(wrapper);
    await wrapper.find('[data-testid="debt-fee-input"]').setValue('5000');
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([
      { sign: 'minus', extraDebit: 5000 },
    ]);
  });

  it('с выключенной транзакцией баланс не двигается', async () => {
    const wrapper = mountPanel();
    await openMore(wrapper);
    const toggles = wrapper.findAllComponents({ name: 'ToggleRow' });
    await toggles[toggles.length - 1].vm.$emit('update:modelValue', true);
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([{ sign: null, extraDebit: 0 }]);
  });
});
