import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { http, HttpResponse } from 'msw';
import { createTestQueryClient } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { closeAllPreviewResponse, type CloseAllPreviewBody } from '@/test/mocks/handlers/debts';
import CloseAllDebtsDrawer from './CloseAllDebtsDrawer.vue';
import type { Debt } from '@/shared/api/database.types';
import { makeDebt } from '@/test/fixtures/debt';
import type { AccountWithBalances } from '@/entities/account';

const { hapticsMock } = vi.hoisted(() => ({ hapticsMock: { trigger: vi.fn() } }));
vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => hapticsMock }));

const accounts = [{ id: 'acc-1', name: 'Карта' }] as unknown as AccountWithBalances[];

/**
 * `UOverlay` уводит содержимое в портал (vaul на мобиле, reka на десктопе) —
 * для юнит-теста самой шторки он подменяется сквозной заглушкой: проверяем
 * то, что шторка показывает из ответа предпросмотра, а не работу портала.
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

type Preview = ReturnType<typeof closeAllPreviewResponse>;

/** Тела, с которыми шторка ходила за предпросмотром, — в порядке запросов. */
let previewBodies: CloseAllPreviewBody[] = [];

/** Сервер считает предпросмотр; шторка обязана показать именно его числа. */
function stubPreview(
  respond: Preview | ((body: CloseAllPreviewBody) => Preview | Promise<Preview>),
) {
  server.use(
    http.post('*/api/debts/close-all/preview', async ({ request }) => {
      const body = (await request.json()) as CloseAllPreviewBody;
      previewBodies.push(body);
      return HttpResponse.json(typeof respond === 'function' ? await respond(body) : respond);
    }),
  );
}

function mountDrawer(debts: Debt[], extraProps: Record<string, unknown> = {}) {
  return mount(CloseAllDebtsDrawer, {
    props: { modelValue: true, debts, personName: 'Алексей', accounts, ...extraProps },
    global: {
      ...globalOptions,
      plugins: [[VueQueryPlugin, { queryClient: createTestQueryClient() }]],
    },
  });
}

type Wrapper = ReturnType<typeof mountDrawer>;

const rowEls = (w: Wrapper) => w.findAll('[data-testid="close-all-debt-row"]');
const rows = (w: Wrapper) => rowEls(w).map((r) => r.text());
const skeletonRows = (w: Wrapper) => w.findAll('[data-testid="close-all-skeleton-row"]');
const submit = (w: Wrapper) => w.find('[data-testid="close-all-submit"]');
const normalized = (text: string) => text.replace(/\s/g, ' ');

/** Ждёт первого ответа предпросмотра: строки долгов появились вместо скелета. */
async function mountReady(debts: Debt[], extraProps: Record<string, unknown> = {}) {
  const wrapper = mountDrawer(debts, extraProps);
  await vi.waitFor(() => expect(rowEls(wrapper).length).toBeGreaterThan(0));
  await flushPromises();
  return wrapper;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Дебаунс суммы — 300 мс; ждём с запасом и даём ответу долететь. */
async function afterDebounce(wrapper?: VueWrapper) {
  await sleep(380);
  await flushPromises();
  await wrapper?.vm.$nextTick();
}

const payment = (debtId: string, amount: number, extra: Partial<Preview['payments'][0]> = {}) => ({
  debtId,
  amount,
  forgive: false,
  withExcess: false,
  ...extra,
});

describe('CloseAllDebtsDrawer', () => {
  const twoDebts = [
    makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, created_at: '2026-01-01' }),
    makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 20_000, created_at: '2026-02-01' }),
  ];

  /** Сервер платит оба долга: сумма платежа решает, что достанется каждому. */
  const payAllOfTwo = closeAllPreviewResponse({
    net: 30_000,
    totalDebt: 30_000,
    payments: [payment('d1', 10_000), payment('d2', 20_000)],
  });

  beforeEach(() => {
    previewBodies = [];
  });

  describe('пока предпросмотр не пришёл', () => {
    it('вместо строк долгов — скелет, а кнопка заблокирована', async () => {
      let release!: () => void;
      const gate = new Promise<void>((res) => {
        release = res;
      });
      stubPreview(async () => {
        await gate;
        return payAllOfTwo;
      });

      const wrapper = mountDrawer(twoDebts);
      await flushPromises();

      expect(skeletonRows(wrapper)).toHaveLength(2);
      expect(rowEls(wrapper)).toHaveLength(0);
      expect(wrapper.find('[data-testid="close-all-amount-input"]').exists()).toBe(false);
      expect(submit(wrapper).attributes('disabled')).toBeDefined();

      // Блокировку держит именно ожидание ответа: клик в это время ничего не отдаёт наружу.
      await submit(wrapper).trigger('click');
      expect(wrapper.emitted('confirm')).toBeUndefined();

      release();
      await vi.waitFor(() => expect(rowEls(wrapper)).toHaveLength(2));
      expect(skeletonRows(wrapper)).toHaveLength(0);
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  describe('«оплатить всё»', () => {
    it('первый запрос — без суммы, а стартовая сумма берётся из ответа сервера', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts);

      expect(previewBodies).toEqual([{ debtIds: ['d1', 'd2'] }]);
      const input = wrapper.find<HTMLInputElement>('[data-testid="close-all-amount-input"]');
      expect(input.element.value.replace(/\s/g, '')).toBe('30000');
    });

    it('закрывает все долги, и второго запроса за теми же числами нет', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts);
      await afterDebounce(wrapper);

      expect(rows(wrapper).every((t) => t.includes('Закроется'))).toBe(true);
      expect(wrapper.text()).toContain('закроется 2 из 2');
      expect(previewBodies).toHaveLength(1);
    });

    it('«оплатить всё» уходит наружу без суммы — ровно как предпросмотр', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts);

      await submit(wrapper).trigger('click');

      const [accountId, options] = wrapper.emitted('confirm')?.[0] as [string, object];
      expect(accountId).toBe('acc-1');
      // Ключа нет вовсе: явная сумма устарела бы, если остатки успели измениться.
      expect(options).not.toHaveProperty('paymentAmount');
      expect(options).toEqual({ forgiveRemainder: false, excessCategoryId: undefined });
    });

    it('другая сумма уходит наружу вместе с ней', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      await afterDebounce(wrapper);
      await submit(wrapper).trigger('click');

      expect(wrapper.emitted('confirm')?.[0]).toEqual([
        'acc-1',
        { paymentAmount: 15_000, forgiveRemainder: false, excessCategoryId: undefined },
      ]);
    });

    it('повторное открытие снова спрашивает сервер и не берёт прошлый ответ', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts);
      expect(previewBodies).toHaveLength(1);

      await wrapper.setProps({ modelValue: false });
      await wrapper.setProps({ modelValue: true });
      await vi.waitFor(() => expect(previewBodies).toHaveLength(2));
      expect(previewBodies[1]).toEqual({ debtIds: ['d1', 'd2'] });
    });
  });

  describe('другая сумма', () => {
    it('предпросмотр уходит не на каждую правку, а после паузы в 300 мс', async () => {
      stubPreview((body) =>
        body.paymentAmount === 15_000
          ? closeAllPreviewResponse({
              net: 30_000,
              totalDebt: 30_000,
              payments: [payment('d1', 10_000), payment('d2', 5_000)],
            })
          : payAllOfTwo,
      );
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      await sleep(100);
      expect(previewBodies).toHaveLength(1);

      await afterDebounce(wrapper);
      expect(previewBodies).toHaveLength(2);
      expect(previewBodies[1]).toEqual({
        debtIds: ['d1', 'd2'],
        paymentAmount: 15_000,
      });
    });

    it('распределение — из ответа: старый долг закрыт, второму достаётся остаток суммы', async () => {
      stubPreview((body) =>
        body.paymentAmount === 15_000
          ? closeAllPreviewResponse({
              net: 30_000,
              totalDebt: 30_000,
              payments: [payment('d1', 10_000), payment('d2', 5_000)],
            })
          : payAllOfTwo,
      );
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      await afterDebounce(wrapper);

      const [first, second] = rows(wrapper);
      expect(first).toContain('Закроется');
      expect(second).toContain('Частично');
      expect(wrapper.text()).toContain('закроется 1 из 2');
    });

    it('пока новый ответ в пути, показывается прошлый, а кнопка заблокирована', async () => {
      let release!: () => void;
      const gate = new Promise<void>((res) => {
        release = res;
      });
      stubPreview(async (body) => {
        if (body.paymentAmount === 15_000) await gate;
        return payAllOfTwo;
      });
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      // Пауза набора ещё идёт: ответа на текущую сумму нет.
      expect(submit(wrapper).attributes('disabled')).toBeDefined();
      await afterDebounce(wrapper);

      // Запрос ушёл, но не вернулся: строки на месте (не скелет), отправлять рано.
      expect(previewBodies).toHaveLength(2);
      expect(rowEls(wrapper)).toHaveLength(2);
      expect(skeletonRows(wrapper)).toHaveLength(0);
      expect(submit(wrapper).attributes('disabled')).toBeDefined();

      release();
      await vi.waitFor(() => expect(submit(wrapper).attributes('disabled')).toBeUndefined());
    });

    it('«Простить» уходит как нулевая сумма с прощением, а в ответе все долги прощаются', async () => {
      stubPreview((body) =>
        body.forgiveRemainder
          ? closeAllPreviewResponse({
              net: 30_000,
              totalDebt: 30_000,
              payments: [payment('d1', 0, { forgive: true }), payment('d2', 0, { forgive: true })],
            })
          : payAllOfTwo,
      );
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      await afterDebounce(wrapper);

      expect(previewBodies[1]).toEqual({
        debtIds: ['d1', 'd2'],
        paymentAmount: 0,
        forgiveRemainder: true,
      });
      expect(rows(wrapper).every((t) => t.includes('Простится'))).toBe(true);
      expect(submit(wrapper).text()).toContain('Простить все долги');
    });

    it('деньги плюс прощение остатка не выдаются за полностью прощённый долг', async () => {
      stubPreview((body) =>
        body.paymentAmount === 15_000
          ? closeAllPreviewResponse({
              net: 30_000,
              totalDebt: 30_000,
              payments: [payment('d1', 10_000), payment('d2', 5_000, { forgive: true })],
            })
          : payAllOfTwo,
      );
      const wrapper = await mountReady(twoDebts);

      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      const input = wrapper.find<HTMLInputElement>('[data-testid="close-all-amount-input"]');
      input.element.value = '15000';
      await input.trigger('input');
      await afterDebounce(wrapper);

      const [first, second] = rows(wrapper);
      expect(first).toContain('Закроется');
      expect(second).toContain('Часть + прощение');
      expect(second).not.toContain('Простится');
      expect(wrapper.text()).toContain('закроется 2 из 2');
    });
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

    // Зачёт 10 000 гасит g1 и «Мой долг»; платежом закрывается остаток 25 000.
    const mutualPreview = closeAllPreviewResponse({
      offsetAmount: 10_000,
      direction: 'given',
      net: 25_000,
      totalDebt: 25_000,
      offsetParts: [
        { debtId: 'g1', amount: 10_000 },
        { debtId: 't', amount: 10_000 },
      ],
      payments: [payment('g1', 5_000), payment('g2', 20_000)],
    });

    it('показывает зачёт и направление из ответа сервера', async () => {
      stubPreview(mutualPreview);
      const wrapper = await mountReady(mutual);

      expect(wrapper.text()).toContain('вам должны · 3 долга');
      expect(normalized(wrapper.find('[data-testid="close-all-offset-note"]').text())).toContain(
        'Сначала зачёт: по 10 000 UZS с каждой стороны',
      );
      expect(rows(wrapper)).toEqual([
        expect.stringContaining('Закроется'),
        expect.stringContaining('Закроется'),
        expect.stringContaining('Зачтётся'),
      ]);
    });

    it('стартовая сумма — остаток после зачёта, посчитанный сервером', async () => {
      stubPreview(mutualPreview);
      const wrapper = await mountReady(mutual);

      const input = wrapper.find<HTMLInputElement>('[data-testid="close-all-amount-input"]');
      expect(input.element.value.replace(/\s/g, '')).toBe('25000');
    });

    it('частичная сумма ложится после зачёта — по расчёту сервера', async () => {
      stubPreview((body) =>
        body.paymentAmount === 12_500
          ? { ...mutualPreview, payments: [payment('g1', 5_000), payment('g2', 7_500)] }
          : mutualPreview,
      );
      const wrapper = await mountReady(mutual);

      await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');
      await afterDebounce(wrapper);

      const [first, second, third] = rows(wrapper);
      expect(first).toContain('Закроется');
      expect(second).toContain('Частично');
      expect(third).toContain('Зачтётся');
      expect(wrapper.text()).toContain('закроется 2 из 3');
    });

    it('равные встречные долги закрываются одним зачётом, без суммы платежа', async () => {
      stubPreview(
        closeAllPreviewResponse({
          offsetAmount: 5_000,
          direction: 'given',
          net: 0,
          totalDebt: 0,
          offsetParts: [
            { debtId: 'g', amount: 5_000 },
            { debtId: 't', amount: 5_000 },
          ],
        }),
      );
      const wrapper = await mountReady([
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
      expect(submit(wrapper).text()).toContain('Зачесть все долги');
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
    });

    describe('пока расчёт в пути (повторное открытие, смена остатков)', () => {
      /** Закрывает и открывает шторку заново; ответ придержан, пока не позовут `release`. */
      async function holdPreview() {
        stubPreview(mutualPreview);
        const wrapper = await mountReady(mutual);
        let release!: () => void;
        const gate = new Promise<void>((res) => {
          release = res;
        });
        stubPreview(async () => {
          await gate;
          return mutualPreview;
        });
        return { wrapper, release };
      }

      /** Ничего, что зависит от стороны или суммы, не рисуется, пока сервер их не назвал. */
      function expectNothingFromGuesswork(wrapper: Wrapper) {
        expect(wrapper.text()).not.toMatch(/вам должны|вы должны/);
        expect(wrapper.find('debt-payment-fields-stub').exists()).toBe(false);
        expect(wrapper.find('debt-progress-meter-stub').exists()).toBe(false);
        expect(wrapper.find('account-selector-stub').exists()).toBe(false);
        expect(wrapper.find('[data-testid="close-all-amount-skeleton"]').exists()).toBe(true);
        // Скелет, а не строки прошлого ответа.
        expect(rowEls(wrapper)).toHaveLength(0);
        expect(skeletonRows(wrapper)).toHaveLength(3);
        expect(submit(wrapper).attributes('disabled')).toBeDefined();
      }

      async function expectServerAnswerShown(wrapper: Wrapper) {
        await vi.waitFor(() => expect(rowEls(wrapper)).toHaveLength(3));
        // Первым в списке стоит долг «взял», а сторона — «вам должны», как сказал сервер.
        expect(wrapper.text()).toContain('вам должны · 3 долга');
        const fields = wrapper.findComponent({ name: 'DebtPaymentFields' });
        expect(fields.props('isOverpayment')).toBe(false);
        expect(fields.props('direction')).toBe('given');
        expect(wrapper.find('account-selector-stub').attributes('label')).toBe('Куда зачислить');
        expect(wrapper.find('debt-progress-meter-stub').exists()).toBe(true);
      }

      it('повторное открытие: ни переплаты, ни направления первого долга до ответа сервера', async () => {
        const { wrapper, release } = await holdPreview();

        await wrapper.setProps({ modelValue: false });
        await wrapper.setProps({ modelValue: true });
        await flushPromises();

        expectNothingFromGuesswork(wrapper);

        release();
        await expectServerAnswerShown(wrapper);
      });

      it('остатки изменились под открытой шторкой: форма снова прячется до ответа', async () => {
        const { wrapper, release } = await holdPreview();
        // Введённая сумма остаётся, а итог для неё ещё неизвестен.
        await wrapper.find('[data-testid="close-all-preset-half"]').trigger('click');

        await wrapper.setProps({
          debts: mutual.map((d) => ({ ...d, remaining_amount: d.remaining_amount - 1_000 })),
        });
        await flushPromises();

        expectNothingFromGuesswork(wrapper);

        release();
        await expectServerAnswerShown(wrapper);
      });
    });
  });

  describe('разные валюты', () => {
    const mixed = [
      makeDebt({ id: 'd1', name: 'Долг 1', remaining_amount: 10_000, currency: 'UZS' }),
      makeDebt({ id: 'd2', name: 'Долг 2', remaining_amount: 100, currency: 'USD' }),
    ];

    // Суммы в разных валютах сервер не складывает: итог в ответе нулевой.
    const mixedPreview = closeAllPreviewResponse({
      payments: [payment('d1', 10_000), payment('d2', 100)],
    });

    it('прячет ввод суммы и показывает итог по каждой валюте', async () => {
      stubPreview(mixedPreview);
      const wrapper = await mountReady(mixed);

      expect(wrapper.find('[data-testid="close-all-amount-input"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="close-all-preset-half"]').exists()).toBe(false);
      const text = normalized(wrapper.text());
      expect(text).toContain('10 000 UZS');
      expect(text).toContain('$100');
    });

    it('«оплатить всё»: запрос без суммы, кнопка доступна', async () => {
      stubPreview(mixedPreview);
      const wrapper = await mountReady(mixed);

      expect(previewBodies).toEqual([{ debtIds: ['d1', 'd2'] }]);
      expect(submit(wrapper).text()).toContain('Закрыть все долги');
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
    });

    it('«простить всё»: флаг прощения без суммы', async () => {
      stubPreview((body) =>
        body.forgiveRemainder
          ? closeAllPreviewResponse({
              payments: [payment('d1', 0, { forgive: true }), payment('d2', 0, { forgive: true })],
            })
          : mixedPreview,
      );
      const wrapper = await mountReady(mixed);

      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      await afterDebounce(wrapper);

      expect(previewBodies[1]).toEqual({
        debtIds: ['d1', 'd2'],
        forgiveRemainder: true,
      });
      expect(rows(wrapper).every((t) => t.includes('Простится'))).toBe(true);
      expect(submit(wrapper).text()).toContain('Простить все долги');
    });

    it('выбор из двух: предпросмотр всегда совпадает с кнопкой, «закроется» при заблокированной кнопке не бывает', async () => {
      stubPreview((body) =>
        body.forgiveRemainder
          ? closeAllPreviewResponse({
              payments: [payment('d1', 0, { forgive: true }), payment('d2', 0, { forgive: true })],
            })
          : mixedPreview,
      );
      const wrapper = await mountReady(mixed);

      /** Если строки обещают закрытие, отправить это можно. */
      const expectPreviewMatchesSubmit = () => {
        const closing =
          rows(wrapper).length > 0 && rows(wrapper).every((t) => t.includes('Закроется'));
        if (closing) expect(submit(wrapper).attributes('disabled')).toBeUndefined();
      };

      expectPreviewMatchesSubmit();

      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      await afterDebounce(wrapper);
      expect(rows(wrapper).every((t) => t.includes('Простится'))).toBe(true);
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();

      // Тумблер прощения, если бы он дотянулся до формы: «не прощать» = «оплатить всё».
      wrapper
        .findComponent({ name: 'DebtPaymentFields' })
        .vm.$emit('update:forgiveRemainder', false);
      await afterDebounce(wrapper);
      expect(previewBodies.at(-1)).toEqual({ debtIds: ['d1', 'd2'] });
      expect(rows(wrapper).every((t) => t.includes('Закроется'))).toBe(true);
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
      expectPreviewMatchesSubmit();

      // И обратно: пресет «Всё» возвращает «оплатить», ничего не оставляя от прощения.
      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      await afterDebounce(wrapper);
      await wrapper.find('[data-testid="close-all-preset-all"]').trigger('click');
      await afterDebounce(wrapper);
      expect(previewBodies.at(-1)).toEqual({ debtIds: ['d1', 'd2'] });
      expect(submit(wrapper).text()).toContain('Закрыть все долги');
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
      expectPreviewMatchesSubmit();
    });

    it('исполнение несёт тот же выбор: «оплатить» без суммы и прощения, «простить» — флагом', async () => {
      stubPreview((body) =>
        body.forgiveRemainder
          ? closeAllPreviewResponse({ payments: [payment('d1', 0, { forgive: true })] })
          : mixedPreview,
      );
      const wrapper = await mountReady(mixed);

      await submit(wrapper).trigger('click');
      const [, payAll] = wrapper.emitted('confirm')?.[0] as [string, object];
      expect(payAll).toEqual({ forgiveRemainder: false, excessCategoryId: undefined });
      expect(payAll).not.toHaveProperty('paymentAmount');

      await wrapper.find('[data-testid="close-all-preset-forgive"]').trigger('click');
      await afterDebounce(wrapper);
      await submit(wrapper).trigger('click');
      const [, forgiveAll] = wrapper.emitted('confirm')?.[1] as [string, object];
      expect(forgiveAll).toMatchObject({ forgiveRemainder: true });
    });
  });

  describe('отказ предпросмотра', () => {
    it('объясняет причину словами сервера, не повторяет запрос и не даёт отправить', async () => {
      let calls = 0;
      server.use(
        http.post('*/api/debts/close-all/preview', () => {
          calls++;
          return HttpResponse.json({ message: 'Долг уже закрыт' }, { status: 409 });
        }),
      );
      const wrapper = mountDrawer(twoDebts);

      // Баннер сразу, а не после паузы повтора: отказ по правилам повтором не лечится.
      await vi.waitFor(() =>
        expect(wrapper.find('[data-testid="close-all-preview-error"]').exists()).toBe(true),
      );
      expect(wrapper.find('[data-testid="close-all-preview-error"]').text()).toContain(
        'Долг уже закрыт',
      );
      expect(calls).toBe(1);
      expect(wrapper.find('[data-testid="close-all-preview-retry"]').exists()).toBe(false);
      expect(skeletonRows(wrapper)).toHaveLength(0);
      expect(submit(wrapper).attributes('disabled')).toBeDefined();
    });

    it('отказ по правилам без русского текста: общая причина, а «Повторить» не предлагается', async () => {
      server.use(
        http.post('*/api/debts/close-all/preview', () =>
          HttpResponse.json({ message: 'Debt is closed' }, { status: 409 }),
        ),
      );
      const wrapper = mountDrawer(twoDebts);

      await vi.waitFor(() =>
        expect(wrapper.find('[data-testid="close-all-preview-error"]').exists()).toBe(true),
      );
      expect(wrapper.find('[data-testid="close-all-preview-error"]').text()).toContain(
        'Не удалось рассчитать закрытие долгов',
      );
      expect(wrapper.find('[data-testid="close-all-preview-retry"]').exists()).toBe(false);
    });

    it('разовый сбой сервера лечится одной повторной попыткой без участия пользователя', async () => {
      let calls = 0;
      server.use(
        http.post('*/api/debts/close-all/preview', () => {
          calls++;
          return calls === 1
            ? HttpResponse.json({ message: 'Internal error' }, { status: 500 })
            : HttpResponse.json(payAllOfTwo);
        }),
      );
      const wrapper = mountDrawer(twoDebts);

      // Пока идёт повтор, шторка остаётся на скелете, а не на сообщении об ошибке.
      await flushPromises();
      expect(wrapper.find('[data-testid="close-all-preview-error"]').exists()).toBe(false);
      expect(skeletonRows(wrapper)).toHaveLength(2);

      await vi.waitFor(() => expect(rowEls(wrapper)).toHaveLength(2), { timeout: 4000 });
      expect(calls).toBe(2);
    });

    it('стойкий сбой оставляет кнопку «Повторить», и после неё шторка оживает', async () => {
      let failing = true;
      server.use(
        http.post('*/api/debts/close-all/preview', () =>
          failing
            ? HttpResponse.json({ message: 'Internal error' }, { status: 500 })
            : HttpResponse.json(payAllOfTwo),
        ),
      );
      const wrapper = mountDrawer(twoDebts);

      await vi.waitFor(
        () => expect(wrapper.find('[data-testid="close-all-preview-retry"]').exists()).toBe(true),
        { timeout: 4000 },
      );
      expect(wrapper.find('[data-testid="close-all-preview-error"]').text()).toContain(
        'Не удалось рассчитать закрытие долгов',
      );
      expect(submit(wrapper).attributes('disabled')).toBeDefined();

      failing = false;
      await wrapper.find('[data-testid="close-all-preview-retry"]').trigger('click');
      await vi.waitFor(() => expect(rowEls(wrapper)).toHaveLength(2));
      expect(wrapper.find('[data-testid="close-all-preview-error"]').exists()).toBe(false);
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  describe('счёт', () => {
    it('предпросмотр не ждёт счёта: статусы долгов видны, а кнопка заблокирована с подсказкой', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts, { accounts: [] });

      expect(previewBodies).toHaveLength(1);
      expect(rows(wrapper).every((t) => t.includes('Закроется'))).toBe(true);
      expect(wrapper.text()).toContain('закроется 2 из 2');
      expect(wrapper.find('account-selector-stub').exists()).toBe(true);
      expect(wrapper.text()).toContain('Выберите счёт для проведения платежей');
      expect(submit(wrapper).attributes('disabled')).toBeDefined();
    });

    it('счета загрузились после открытия — первый выбирается сам, расчёт не перезапрашивается', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts, { accounts: [] });

      await wrapper.setProps({ accounts });
      await afterDebounce(wrapper);

      expect(previewBodies).toHaveLength(1);
      expect(wrapper.text()).not.toContain('Выберите счёт для проведения платежей');
      expect(submit(wrapper).attributes('disabled')).toBeUndefined();
    });

    it('смена счёта расчёт не перезапрашивает и уходит наружу с выбранным счётом', async () => {
      stubPreview(payAllOfTwo);
      const wrapper = await mountReady(twoDebts, {
        accounts: [...accounts, { id: 'acc-2', name: 'Наличные' }],
      });

      wrapper.findComponent({ name: 'AccountSelector' }).vm.$emit('select', 'acc-2');
      await afterDebounce(wrapper);

      expect(previewBodies).toHaveLength(1);
      await submit(wrapper).trigger('click');
      expect(wrapper.emitted('confirm')?.[0]?.[0]).toBe('acc-2');
    });
  });

  it('пока идёт закрытие, кнопка заблокирована и говорит о работе', async () => {
    stubPreview(payAllOfTwo);
    const wrapper = await mountReady(twoDebts, { isClosing: true });

    expect(submit(wrapper).text()).toContain('Закрываем');
    expect(submit(wrapper).attributes('disabled')).toBeDefined();
  });
});
