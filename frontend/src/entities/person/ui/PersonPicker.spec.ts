import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PersonPicker from './PersonPicker.vue';
import type { Person } from '../model/types';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));

function person(name: string, id = name): Person {
  return {
    id,
    user_id: 'u1',
    name,
    color: '#3b82f6',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(PersonPicker, {
    props: { people: [], selected: '', ...props },
    global: { stubs: { PersonPickerSheet: true, UIcon: true, InitialAvatar: true } },
  });
}

const chips = (w: ReturnType<typeof mountPicker>) =>
  w.findAll('[data-testid="person-chip"]').map((c) => c.text());

describe('PersonPicker', () => {
  it('выдаёт людей от часто используемых к редким', () => {
    const now = new Date().toISOString();
    const wrapper = mountPicker({
      people: [person('Редкий'), person('Частый')],
      debts: [
        { person_name: 'Частый', created_at: now },
        { person_name: 'Частый', created_at: now },
        { person_name: 'Редкий', created_at: now },
      ],
    });
    expect(chips(wrapper)).toEqual(['Частый', 'Редкий']);
  });

  it('эмитит select с именем по тапу на чип', async () => {
    const wrapper = mountPicker({ people: [person('Азиз')] });
    await wrapper.find('[data-testid="person-chip"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['Азиз']);
  });

  it('показывает не больше восьми чипов и кнопку «Ещё N»', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(`Ч${i}`, `p${i}`));
    const wrapper = mountPicker({ people });
    expect(wrapper.findAll('[data-testid="person-chip"]')).toHaveLength(8);
    expect(wrapper.find('[data-testid="person-more"]').text()).toContain('4');
  });

  it('кнопка открытия шита есть и когда прятать нечего — иначе не завести нового', () => {
    const wrapper = mountPicker({ people: [person('Азиз')] });
    expect(wrapper.find('[data-testid="person-more"]').text()).toContain('Другой');
  });

  it('пиннит выбранного, если он не попал в топ', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(`Ч${i}`, `p${i}`));
    // Первым восьми даём по долгу — они и займут весь инлайн-ряд по частоте.
    const debts = people
      .slice(0, 8)
      .map((p) => ({ person_name: p.name, created_at: new Date().toISOString() }));
    const wrapper = mountPicker({ people, debts, selected: 'Ч11' });
    expect(chips(wrapper)[0]).toBe('Ч11');
    expect(chips(wrapper)).toHaveLength(8);
  });

  it('в режиме multiple помечает всех выбранных', () => {
    const wrapper = mountPicker({
      people: [person('Азиз'), person('Мама')],
      selected: ['Азиз', 'Мама'],
      multiple: true,
    });
    expect(wrapper.findAll('[data-testid="person-chip"][aria-pressed="true"]')).toHaveLength(2);
  });

  it('без людей оставляет только кнопку шита и зовёт добавить', () => {
    const wrapper = mountPicker();
    expect(wrapper.findAll('[data-testid="person-chip"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="person-more"]').text()).toContain('Добавить человека');
  });
});
