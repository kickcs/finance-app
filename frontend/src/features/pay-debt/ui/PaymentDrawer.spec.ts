import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createTestQueryClient } from '@/test/test-utils';
import { categoryQueryKeys } from '@/entities/category';
import PaymentDrawer from './PaymentDrawer.vue';
import { makeDebt } from '@/test/fixtures/debt';
import type { Debt } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const accounts = [
  { id: 'acc-1', name: 'Карта' },
  { id: 'acc-2', name: 'Наличные' },
] as unknown as AccountWithBalances[];

/**
 * `UOverlay` уводит содержимое в портал — для юнита шторки он подменяется
 * сквозной заглушкой: проверяется логика суммы и пресетов, а не портал.
 */
const OverlayStub = {
  name: 'UOverlay',
  props: ['modelValue', 'title', 'desktop', 'maxHeight', 'fill'],
  template: '<div><slot name="action" /><slot /><slot name="footer" /></div>',
};

// Категории пользователя: шторка выбирает работу и переплату из них, а не из встроенных.
const userCategories = [
  {
    id: 'u-repair',
    user_id: 'user-1',
    name: 'Ремонт',
    icon: 'build',
    color: '#000',
    type: 'expense',
    sort_order: 0,
    is_frequent: true,
    created_at: '',
  },
  {
    id: 'u-gifts',
    user_id: 'user-1',
    name: 'Подарки',
    icon: 'redeem',
    color: '#000',
    type: 'income',
    sort_order: 0,
    is_frequent: true,
    created_at: '',
  },
];

function mountDrawer(debt: Debt | null, extraProps: Record<string, unknown> = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryDefaults(categoryQueryKeys.all, { staleTime: Infinity });
  queryClient.setQueryData(categoryQueryKeys.list('user-1'), userCategories);
  return mount(PaymentDrawer, {
    props: { modelValue: true, debt, accounts, ...extraProps },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { user: ref({ id: 'user-1' }) },
      stubs: {
        UOverlay: OverlayStub,
        AccountSelector: true,
        DebtProgressMeter: true,
        DebtPaymentFields: true,
      },
    },
  });
}

const openDebt = makeDebt({ total_amount: 1000, remaining_amount: 800, account_id: 'acc-2' });

const submit = (w: ReturnType<typeof mountDrawer>) =>
  w.get('[data-testid="payment-drawer-submit"]');
const amountOf = (w: ReturnType<typeof mountDrawer>) =>
  Number((w.get('[data-testid="payment-amount-input"]').element as HTMLInputElement).value);

async function open(w: ReturnType<typeof mountDrawer>) {
  await w.setProps({ modelValue: false });
  await w.setProps({ modelValue: true });
}

describe('PaymentDrawer', () => {
  it('открывается на остатке долга и на его счёте', async () => {
    const w = mountDrawer(openDebt);
    await open(w);

    expect(amountOf(w)).toBe(800);
    expect(w.findComponent({ name: 'AccountSelector' }).props('selectedId')).toBe('acc-2');
  });

  it('без счёта у долга берёт первый из списка', async () => {
    const w = mountDrawer(makeDebt({ remaining_amount: 800, account_id: null }));
    await open(w);

    expect(w.findComponent({ name: 'AccountSelector' }).props('selectedId')).toBe('acc-1');
  });

  it('черновик неудавшегося платежа накатывается поверх дефолтов', async () => {
    const w = mountDrawer(openDebt, {
      draft: { amount: 300, accountId: 'acc-1', forgiveRemainder: true },
    });
    await open(w);

    expect(amountOf(w)).toBe(300);
    expect(w.findComponent({ name: 'AccountSelector' }).props('selectedId')).toBe('acc-1');
    expect(w.findComponent({ name: 'DebtPaymentFields' }).props('forgiveRemainder')).toBe(true);
  });

  describe('пресеты', () => {
    it('половина ставит половину остатка', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="preset-half"]').trigger('click');

      expect(amountOf(w)).toBe(400);
      expect(submit(w).text()).toContain('Внести');
    });

    it('«всё» закрывает долг целиком', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="preset-half"]').trigger('click');
      await w.get('[data-testid="preset-all"]').trigger('click');

      expect(amountOf(w)).toBe(800);
      expect(submit(w).text()).toBe('Закрыть долг');
    });

    // «Простить» — единственный пресет, обнуляющий сумму: раньше он оставлял
    // включённой галочку прощения при возврате к обычному платежу.
    it('«простить» обнуляет сумму, а возврат к сумме снимает прощение', async () => {
      const w = mountDrawer(openDebt);
      await open(w);

      await w.get('[data-testid="preset-forgive"]').trigger('click');
      expect(amountOf(w)).toBe(0);
      expect(submit(w).text()).toBe('Простить долг');

      await w.get('[data-testid="preset-half"]').trigger('click');
      expect(w.findComponent({ name: 'DebtPaymentFields' }).props('forgiveRemainder')).toBe(false);
    });
  });

  describe('подтверждение', () => {
    it('отдаёт наружу сумму, счёт и прощение', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="preset-all"]').trigger('click');
      await submit(w).trigger('click');

      expect(w.emitted('confirm')?.[0][0]).toEqual({
        amount: 800,
        accountId: 'acc-2',
        forgiveRemainder: false,
        excessCategoryId: undefined,
        settleWithWork: false,
        workNote: undefined,
      });
    });

    it('категорию переплаты прикладывает только к переплате', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="payment-amount-input"]').setValue(1500);
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.amount).toBe(1500);
      expect(payload.excessCategoryId).toBe('u-gifts');
    });

    it('нулевой платёж без прощения подтвердить нельзя', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="payment-amount-input"]').setValue(0);

      expect(submit(w).attributes('disabled')).toBeDefined();
      await submit(w).trigger('click');
      expect(w.emitted('confirm')).toBeUndefined();
    });
  });

  describe('отработка', () => {
    it('прячет выбор счёта: деньги по счетам не двигаются', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      expect(w.findComponent({ name: 'AccountSelector' }).exists()).toBe(true);

      await w.get('[data-testid="work-off-open"]').trigger('click');

      expect(w.find('[data-testid="work-off-field"]').exists()).toBe(true);
      expect(w.findComponent({ name: 'AccountSelector' }).exists()).toBe(false);
      expect(submit(w).text()).toBe('Закрыть отработкой');
    });

    it('отдаёт наружу отметку и заметку о работе', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="work-off-open"]').trigger('click');
      await w.get('[data-testid="work-off-field"] input').setValue('ремонт машины');
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.settleWithWork).toBe(true);
      expect(payload.workNote).toBe('ремонт машины');
      // Счёт из долга уходит и при отработке: отметке всё равно нужен счёт
      expect(payload.accountId).toBe('acc-2');
    });

    // Отработать больше остатка нечего — сервер такой платёж отклоняет,
    // поэтому сумма подрезается прямо в форме.
    it('подрезает сумму до остатка', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="payment-amount-input"]').setValue(1500);
      await w.get('[data-testid="work-off-open"]').trigger('click');

      expect(amountOf(w)).toBe(800);
    });

    // Категория переводит отработку из «просто отметки» в пару записей,
    // которую видно в аналитике, — поэтому она уходит наружу отдельным полем.
    it('без категории отдаёт отработку как отметку', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="work-off-open"]').trigger('click');
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.settleWithWork).toBe(true);
      expect(payload.workCategoryId).toBeUndefined();
    });

    it('«учесть работу тратой» прикладывает категорию', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="work-off-open"]').trigger('click');
      await w.get('[data-testid="work-off-accounting"] [role="switch"]').trigger('click');
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.workCategoryId).toBe('u-repair');
    });

    it('возврат к деньгам стирает и категорию работы', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="work-off-open"]').trigger('click');
      await w.get('[data-testid="work-off-accounting"] [role="switch"]').trigger('click');
      await w.get('[data-testid="work-off-close"]').trigger('click');
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.workCategoryId).toBeUndefined();
    });

    it('возврат к деньгам возвращает выбор счёта и стирает заметку', async () => {
      const w = mountDrawer(openDebt);
      await open(w);
      await w.get('[data-testid="work-off-open"]').trigger('click');
      await w.get('[data-testid="work-off-field"] input').setValue('ремонт машины');
      await w.get('[data-testid="work-off-close"]').trigger('click');
      await submit(w).trigger('click');

      const payload = w.emitted('confirm')?.[0][0] as Record<string, unknown>;
      expect(payload.settleWithWork).toBe(false);
      expect(payload.workNote).toBeUndefined();
      expect(w.findComponent({ name: 'AccountSelector' }).exists()).toBe(true);
    });
  });

  it('без долга внутри ничего не рисует', () => {
    expect(mountDrawer(null).find('[data-testid="payment-drawer"]').exists()).toBe(false);
  });
});
