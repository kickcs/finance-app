import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryChips from './CategoryChips.vue';
import type { Category } from '@/entities/category';

const categories: Category[] = [
  { id: 'food', name: 'Еда', icon: 'restaurant', color: '#f00', type: 'expense' },
  { id: 'taxi', name: 'Такси', icon: 'local_taxi', color: '#0f0', type: 'expense' },
  {
    id: 'gifts',
    name: 'Подарки',
    icon: 'redeem',
    color: '#00f',
    type: 'expense',
    isFrequent: false,
  },
];

function mountChips() {
  return mount(CategoryChips, {
    props: { categories, selectedId: '', searchable: true },
    attachTo: document.body,
  });
}

function findChip(wrapper: ReturnType<typeof mountChips>, name: string) {
  const chip = wrapper.findAll('button').find((b) => b.text().includes(name));
  if (!chip) throw new Error(`Chip not found: ${name}`);
  return chip;
}

async function openSearch(wrapper: ReturnType<typeof mountChips>) {
  await findChip(wrapper, 'Поиск').trigger('click');
}

function dispatchMousedown(el: Element): MouseEvent {
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('CategoryChips', () => {
  it('selects category on click and emits select', async () => {
    const wrapper = mountChips();
    await findChip(wrapper, 'Еда').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['food']]);
    wrapper.unmount();
  });

  // iOS: mousedown on a chip blurs the search input, the keyboard closes and
  // the layout shifts before click is dispatched, so the tap misses.
  // Preventing mousedown keeps focus (and keyboard) until click lands.
  it('prevents mousedown on chips while search is active so the input keeps focus', async () => {
    const wrapper = mountChips();
    await openSearch(wrapper);

    const event = dispatchMousedown(findChip(wrapper, 'Еда').element);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it('prevents mousedown on the close-search button while search is active', async () => {
    const wrapper = mountChips();
    await openSearch(wrapper);

    const event = dispatchMousedown(findChip(wrapper, 'Закрыть').element);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it('prevents mousedown on the infrequent toggle while search is active', async () => {
    const wrapper = mountChips();
    await openSearch(wrapper);

    const event = dispatchMousedown(findChip(wrapper, 'Ещё').element);
    expect(event.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it('still selects category from search results and closes search', async () => {
    const wrapper = mountChips();
    await openSearch(wrapper);
    const input = wrapper.find('input');
    await input.setValue('так');

    await findChip(wrapper, 'Такси').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['taxi']]);
    expect(wrapper.find('input').exists()).toBe(false);
    wrapper.unmount();
  });
});
