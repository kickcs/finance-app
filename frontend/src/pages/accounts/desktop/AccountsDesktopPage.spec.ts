import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
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

afterEach(() => setIsDesktopForTests(null));

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
});
