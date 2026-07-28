import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TransactionMetaRow from './TransactionMetaRow.vue';

function mountRow(description = '') {
  return mount(TransactionMetaRow, {
    props: {
      description,
      date: new Date('2026-07-27T10:00:00').getTime(),
      placeholder: '#продукты, #кафе...',
      hashtags: [{ tag: '#кафе' }],
    },
    global: { stubs: { UIcon: true } },
  });
}

const dateChip = (w: ReturnType<typeof mountRow>) => w.find('[data-testid="meta-date-chip"]');

describe('TransactionMetaRow', () => {
  it('показывает чип даты в свёрнутом состоянии', () => {
    expect(dateChip(mountRow()).exists()).toBe(true);
  });

  it('оставляет дату на экране, пока комментарий раскрыт и в фокусе', async () => {
    const wrapper = mountRow();
    await wrapper.get('[data-testid="meta-comment-chip"]').trigger('click');

    expect(wrapper.find('input[aria-label="Комментарий"]').exists()).toBe(true);
    expect(dateChip(wrapper).exists()).toBe(true);
  });

  it('оставляет дату на экране, когда в комментарии есть текст', async () => {
    const wrapper = mountRow('кофе');
    await wrapper.get('[data-testid="meta-comment-chip"]').trigger('click');
    await wrapper.get('input[aria-label="Комментарий"]').trigger('blur');

    // Поле остаётся раскрытым с текстом — дата обязана остаться доступной.
    expect(wrapper.find('input[aria-label="Комментарий"]').exists()).toBe(true);
    expect(dateChip(wrapper).exists()).toBe(true);
  });

  it('схлопывает пустой комментарий обратно в чип', async () => {
    const wrapper = mountRow();
    await wrapper.get('[data-testid="meta-comment-chip"]').trigger('click');
    await wrapper.get('input[aria-label="Комментарий"]').trigger('blur');

    expect(wrapper.find('input[aria-label="Комментарий"]').exists()).toBe(false);
    expect(dateChip(wrapper).exists()).toBe(true);
  });
});
