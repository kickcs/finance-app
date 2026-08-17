import { describe, it, expect, afterEach, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { useToast } from '@/shared/lib/composables/useToast';
import type { ToastPosition } from './useToastPosition';
import ToastProvider from './ToastProvider.vue';
import Toaster from './Toaster.vue';

const { toast, toasts, dismissAll } = useToast();

const Host = defineComponent({
  setup: () => () => h(ToastProvider, null, { default: () => h(Toaster) }),
});

const mounted: VueWrapper[] = [];

/**
 * Позиция тостов читается из route meta, поэтому даже юнит-тест на тостер
 * поднимает роутер: без него useToastPosition падает на route.meta.
 */
async function mountToaster(toastPosition: ToastPosition = 'top') {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' }, meta: { toastPosition } }],
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(Host, { global: { plugins: [router] } });
  mounted.push(wrapper);
  await nextTick();
  return wrapper;
}

function transactionData(overrides: Partial<{ amount: string; onUndo: () => Promise<void> }> = {}) {
  return {
    amount: '−45 000',
    categoryName: 'Такси',
    accountName: 'Humo',
    onUndo: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buttonByText(wrapper: VueWrapper, text: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === text);
  if (!found) throw new Error(`Кнопка «${text}» не найдена`);
  return found;
}

// Стор тостов — модульный синглтон: без жёсткой очистки хвост одного теста
// оказывается первым элементом в следующем. Тостеры прошлых тестов подписаны на
// тот же стор, поэтому их тоже снимаем.
afterEach(() => {
  vi.useFakeTimers();
  dismissAll();
  vi.advanceTimersByTime(400);
  vi.useRealTimers();
  mounted.splice(0).forEach((w) => w.unmount());
});

describe('Toaster', () => {
  it('закрывает тост по тапу в любое место карточки', async () => {
    const wrapper = await mountToaster();
    toast({ title: 'Платёж проведён', variant: 'success' });
    await nextTick();

    const card = wrapper.find('li');
    expect(card.exists()).toBe(true);

    await card.trigger('click');

    expect(toasts.value[0]?.open).toBe(false);
  });

  // Исходная жалоба: success-карточка вставала поверх экрана подтверждения
  // импорта, и убрать её было нечем — кроме кнопки, удаляющей транзакцию.
  it('закрывает success-карточку тапом, не трогая саму транзакцию', async () => {
    const wrapper = await mountToaster();
    const data = transactionData();
    toast({ variant: 'transaction-success', transactionData: data });
    await nextTick();

    await wrapper.find('li').trigger('click');

    expect(toasts.value[0]?.open).toBe(false);
    expect(data.onUndo).not.toHaveBeenCalled();
  });

  it('не закрывает тапом тост с действием — промах мимо кнопки не должен его стоить', async () => {
    const wrapper = await mountToaster();
    toast({
      title: 'Доступно обновление',
      variant: 'success',
      action: { label: 'Обновить', onClick: vi.fn() },
    });
    await nextTick();

    await wrapper.find('li').trigger('click');

    expect(toasts.value[0]?.open).toBe(true);
  });

  it('на тапе «Отменить» откатывает транзакцию, а не просто закрывает тост', async () => {
    const wrapper = await mountToaster();
    const data = transactionData();
    toast({ variant: 'transaction-success', transactionData: data });
    await nextTick();

    await buttonByText(wrapper, 'Отменить').trigger('click');

    expect(data.onUndo).toHaveBeenCalledTimes(1);
  });

  it('показывает крестик без наведения — на тач-устройствах hover не наступает', async () => {
    const wrapper = await mountToaster();
    toast({ title: 'Платёж проведён', variant: 'success' });
    await nextTick();

    const close = wrapper.find('[aria-label="Закрыть"]');
    expect(close.exists()).toBe(true);
    expect(close.classes()).not.toContain('opacity-0');
  });

  it('вытесняет предыдущую success-карточку вместо того чтобы копить стопку', async () => {
    await mountToaster();
    toast({ variant: 'transaction-success', transactionData: transactionData() });
    toast({
      variant: 'transaction-success',
      transactionData: transactionData({ amount: '−12 000' }),
    });
    await nextTick();

    const visible = toasts.value.filter((t) => t.variant === 'transaction-success' && t.open);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.transactionData?.amount).toBe('−12 000');
  });

  it('в верхней позиции прячет строку «категория · счёт» — она уже на экране под тостом', async () => {
    const wrapper = await mountToaster('top');
    toast({ variant: 'transaction-success', transactionData: transactionData() });
    await nextTick();

    expect(wrapper.text()).toContain('−45 000');
    expect(wrapper.text()).not.toContain('Такси');
  });

  it('в нижней позиции оставляет строку «категория · счёт» — экран под ней уже сменился', async () => {
    const wrapper = await mountToaster('bottom');
    toast({ variant: 'transaction-success', transactionData: transactionData() });
    await nextTick();

    expect(wrapper.text()).toContain('Такси');
    expect(wrapper.text()).toContain('Humo');
  });
});
