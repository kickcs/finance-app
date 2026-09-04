import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountTypeSelector from './AccountTypeSelector.vue';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(props: Record<string, unknown> = {}) {
  return renderWithProviders(AccountTypeSelector, {
    provideAuth: { user: mockUser },
    props: { modelValue: 'basic', ...props },
  });
}

describe('AccountTypeSelector', () => {
  it('рисует все видимые типы по умолчанию', async () => {
    currentWrapper = render();
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-type-selector"]').exists()).toBe(true);
    for (const t of ['basic', 'savings', 'cash', 'credit_card']) {
      expect(currentWrapper.find(`[data-testid="account-type-${t}"]`).exists()).toBe(true);
    }
  });

  it('показывает подпись и иконку каждого типа', async () => {
    currentWrapper = render();
    await flushPromises();
    const card = currentWrapper.find('[data-testid="account-type-credit_card"]');
    expect(card.text()).toContain('Кредитная карта');
    expect(card.find('svg').exists()).toBe(true);
  });

  it('помечает выбранный тип', async () => {
    currentWrapper = render({ modelValue: 'savings' });
    await flushPromises();
    expect(
      currentWrapper.find('[data-testid="account-type-savings"]').attributes('aria-pressed'),
    ).toBe('true');
    expect(
      currentWrapper.find('[data-testid="account-type-basic"]').attributes('aria-pressed'),
    ).toBe('false');
  });

  it('эмитит update:modelValue по клику', async () => {
    currentWrapper = render();
    await flushPromises();
    await currentWrapper.find('[data-testid="account-type-credit_card"]').trigger('click');
    expect(currentWrapper.emitted('update:modelValue')?.[0]).toEqual(['credit_card']);
  });

  it('уважает суженный список типов', async () => {
    currentWrapper = render({ types: ['basic', 'cash'] });
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-type-basic"]').exists()).toBe(true);
    expect(currentWrapper.find('[data-testid="account-type-credit_card"]').exists()).toBe(false);
  });
});
