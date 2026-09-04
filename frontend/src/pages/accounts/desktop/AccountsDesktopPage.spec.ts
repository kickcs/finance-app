import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockAccountResponse, mockCreditCardAccountResponse } from '@/test/mocks/handlers/accounts';
import AccountsDesktopPage from './AccountsDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));

/** Заглушка vuedraggable: рендерит слот item на каждый элемент, как на мобильной странице. */
const DraggableStub = defineComponent({
  name: 'Draggable',
  props: { modelValue: { type: Array, default: () => [] }, itemKey: { type: String, default: '' } },
  emits: ['start', 'end', 'update:modelValue'],
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        (props.modelValue as unknown[]).map((item) => slots.item?.({ element: item })),
      );
  },
});

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  setIsDesktopForTests(null);
  currentWrapper?.unmount();
  currentWrapper = null;
  document.body.innerHTML = '';
  await flushPromises();
});

async function mountPage(initialPath = '/accounts') {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    { path: '/accounts', component: { template: '<div />' } },
    { path: '/accounts/:id', component: { template: '<div />' } },
  ]);
  await router.push(initialPath);
  const wrapper = renderWithProviders(AccountsDesktopPage, {
    router,
    provideAuth: { user: mockUser },
    // defineAsyncComponent(() => import('vuedraggable')) резолвится сюда
    global: { stubs: { AsyncComponentWrapper: DraggableStub } },
  });
  // Карточки появляются после двух независимых асинхронных цепочек: запроса
  // счетов и резолва ленивого vuedraggable. Фиксированное число flushPromises
  // против них — гонка, поэтому ждём саму отрисовку.
  currentWrapper = wrapper;
  await vi.waitFor(() => expect(wrapper.find('[data-testid="account-row"]').exists()).toBe(true));
  return { wrapper, router };
}

describe('десктопные Счета', () => {
  it('без выбранного счёта показывает заглушку в правой колонке', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="accounts-detail-empty"]').exists()).toBe(true);
  });

  it('берёт выбранный счёт из query-параметра', async () => {
    const { wrapper } = await mountPage('/accounts?id=acc-1');
    expect(wrapper.find('[data-testid="accounts-detail-empty"]').exists()).toBe(false);
  });

  it('выбор счёта пишется в URL, а не только в локальное состояние', async () => {
    const { wrapper, router } = await mountPage();

    await wrapper.find('[data-testid="account-row"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.id).toBeTruthy();
  });

  it('под общим балансом показывает долг по кредитным картам', async () => {
    server.use(
      http.get('*/api/accounts', () =>
        HttpResponse.json([mockAccountResponse, mockCreditCardAccountResponse]),
      ),
    );
    const { wrapper } = await mountPage();

    const line = wrapper.find('[data-testid="credit-card-debt-line"]');
    expect(line.exists()).toBe(true);
    expect(line.text()).toContain('в т.ч. долг по картам');
    expect(line.text()).toContain('120\u00A0000');
  });

  it('без долга по картам строку не показывает', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="credit-card-debt-line"]').exists()).toBe(false);
  });

  // Тост о неудачной конвертации отправляет пользователя к этой кнопке, поэтому
  // на десктопе она обязана быть — и открывать ту же модалку, что на мобиле.
  it('коррекция баланса доступна из панели счёта', async () => {
    const { wrapper } = await mountPage('/accounts?id=acc-1');

    const btn = wrapper.findAll('button').find((b) => b.text().includes('Скорректировать баланс'));
    expect(btn).toBeDefined();

    await btn!.trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Коррекция баланса');
  });
});
