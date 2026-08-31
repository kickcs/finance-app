import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import DeleteDebtModal from './DeleteDebtModal.vue';
import { makeDebt } from '@/test/fixtures/debt';
import { bodyText } from '@/test/test-utils';
import type { Debt } from '@/shared/api/database.types';

/** `UModal` уносит содержимое в портал — искать его надо в body, не в обёртке. */
async function mountModal(debt: Debt | null, extraProps: Record<string, unknown> = {}) {
  const wrapper = mount(DeleteDebtModal, {
    props: { modelValue: true, debt, currency: 'UZS', ...extraProps },
    attachTo: document.body,
  });
  await nextTick();
  return wrapper;
}

const confirmBtn = () =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('Удалить'));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DeleteDebtModal', () => {
  it('показывает, какой именно долг удаляется, и предупреждает о последствиях', async () => {
    await mountModal(makeDebt({ person_name: 'Азиз', total_amount: 5000 }));

    expect(bodyText()).toContain('Азиз');
    expect(bodyText()).toContain('5 000');
    expect(bodyText()).toContain('баланс счёта восстановлен');
  });

  // Скрытый долг прячет имя и сумму везде, где показан, — подтверждение
  // удаления показывало и то и другое.
  it('скрытый долг остаётся скрытым и в подтверждении удаления', async () => {
    await mountModal(makeDebt({ is_private: true, total_amount: 5000 }));
    expect(bodyText()).not.toContain('Азиз');
    expect(bodyText()).not.toContain('5 000');
  });

  it('подтверждение отдаётся наружу', async () => {
    const w = await mountModal(makeDebt());
    confirmBtn()?.click();
    await w.vm.$nextTick();

    expect(w.emitted('confirm')).toHaveLength(1);
  });

  it('отмена и закрывает шторку, и сообщает об отказе', async () => {
    const w = await mountModal(makeDebt());
    const cancel = [...document.body.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Отмена',
    );
    cancel?.click();
    await w.vm.$nextTick();

    expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
    expect(w.emitted('cancel')).toHaveLength(1);
  });

  it('пока удаление идёт, кнопка занята', async () => {
    await mountModal(makeDebt(), { isDeleting: true });
    expect(confirmBtn()?.hasAttribute('disabled')).toBe(true);
  });
});
