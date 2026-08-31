import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import ParticipantsDrawer from './ParticipantsDrawer.vue';
import type { Participant } from '../model/types';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));

const createPerson = vi.fn();
const peopleRef = ref<{ id: string; name: string; color: string }[]>([]);

vi.mock('@/entities/person', () => ({
  usePeople: () => ({ people: peopleRef, isLoading: ref(false), createPerson }),
  personKey: (name: string) => name.trim().toLowerCase(),
}));

// Шторка целиком приезжает из UOverlay через порталы vaul/reka — здесь важно
// только её содержимое, поэтому обвязку заменяем на голые слоты.
const OverlayStub = {
  props: ['modelValue', 'title', 'desktop'],
  template: '<div><slot /><slot name="footer" /></div>',
};

function participant(name: string, over: Partial<Participant> = {}): Participant {
  return { id: `p-${name}`, name, isMe: false, color: '#4F46E5', paidById: null, ...over };
}

function contact(name: string) {
  return { id: `c-${name}`, name, color: '#4F46E5' };
}

function mountDrawer(props: Record<string, unknown> = {}) {
  return mount(ParticipantsDrawer, {
    props: { open: true, participants: [], assignedCounts: {}, ...props },
    global: {
      provide: { user: ref({ id: 'u1' }) },
      stubs: { UOverlay: OverlayStub, UIcon: true, InitialAvatar: true },
    },
  });
}

const rowTexts = (wrapper: ReturnType<typeof mountDrawer>) =>
  wrapper.findAll('[data-testid="participant-row"]').map((r) => r.text());

beforeEach(() => {
  peopleRef.value = [];
  createPerson.mockReset();
  setIsDesktopForTests(false);
});

afterEach(() => setIsDesktopForTests(null));

describe('ParticipantsDrawer', () => {
  it('показывает всех контактов, а не первые восемь', () => {
    peopleRef.value = Array.from({ length: 14 }, (_, i) => contact(`Человек ${i}`));
    const wrapper = mountDrawer();
    // 14 контактов + строка «Я»
    expect(wrapper.findAll('[data-testid="participant-row"]')).toHaveLength(15);
  });

  it('фильтрует список по поиску', async () => {
    peopleRef.value = [contact('Азиз'), contact('Марина'), contact('Тимур')];
    const wrapper = mountDrawer();
    await wrapper.find('input').setValue('мар');
    expect(rowTexts(wrapper)).toHaveLength(1);
    expect(rowTexts(wrapper)[0]).toContain('Марина');
  });

  it('тап по контакту добавляет его в участники', async () => {
    peopleRef.value = [contact('Азиз')];
    const wrapper = mountDrawer();
    await wrapper.findAll('[data-testid="participant-row"]')[1].trigger('click');
    expect(wrapper.emitted('add')?.[0]).toEqual(['Азиз', false]);
  });

  it('первая строка добавляет «Я»', async () => {
    const wrapper = mountDrawer();
    await wrapper.find('[data-testid="participant-row"]').trigger('click');
    expect(wrapper.emitted('add')?.[0]).toEqual(['Я', true]);
  });

  it('повторный тап убирает участника без назначенных позиций', async () => {
    peopleRef.value = [contact('Азиз')];
    const wrapper = mountDrawer({ participants: [participant('Азиз')] });
    const rows = wrapper.findAll('[data-testid="participant-row"]');
    expect(rows[1].attributes('aria-pressed')).toBe('true');
    await rows[1].trigger('click');
    expect(wrapper.emitted('remove')?.[0]).toEqual(['p-Азиз']);
  });

  it('участника с позициями убирает только второй тап', async () => {
    peopleRef.value = [contact('Азиз')];
    const wrapper = mountDrawer({
      participants: [participant('Азиз')],
      assignedCounts: { 'p-Азиз': 3 },
    });
    const row = () => wrapper.findAll('[data-testid="participant-row"]')[1];
    await row().trigger('click');
    expect(wrapper.emitted('remove')).toBeUndefined();
    expect(row().text()).toContain('Убрать?');
    await row().trigger('click');
    expect(wrapper.emitted('remove')?.[0]).toEqual(['p-Азиз']);
  });

  it('предлагает создать участника, которого нет ни в контактах, ни в чеке', async () => {
    peopleRef.value = [contact('Азиз')];
    const wrapper = mountDrawer();
    await wrapper.find('input').setValue('Новенький');
    const create = wrapper.find('[data-testid="participant-create"]');
    expect(create.text()).toContain('Новенький');
    await create.trigger('click');
    expect(wrapper.emitted('add')?.[0]).toEqual(['Новенький', false]);
  });

  it('не предлагает создание, если такое имя уже есть', async () => {
    peopleRef.value = [contact('Азиз')];
    const wrapper = mountDrawer();
    await wrapper.find('input').setValue('  азиз ');
    expect(wrapper.find('[data-testid="participant-create"]').exists()).toBe(false);
  });

  it('участник не из контактов остаётся в списке и сохраняется в контакты', async () => {
    const wrapper = mountDrawer({ participants: [participant('Гость')] });
    expect(rowTexts(wrapper).join(' ')).toContain('Гость');
    await wrapper.find('[data-testid="save-to-contacts"]').trigger('click');
    expect(createPerson).toHaveBeenCalledWith({ name: 'Гость', color: '#4F46E5' });
  });

  it('выбор плательщика доступен и не строит цепочек', async () => {
    const anya = participant('Аня', { id: 'p-anya' });
    const timur = participant('Тимур', { id: 'p-timur', paidById: 'p-anya' });
    const wrapper = mountDrawer({ participants: [anya, timur] });
    // У Тимура плательщик уже назначен, поэтому кандидатом он не станет:
    // раскрываем селектор у Ани и видим только «Сам».
    await wrapper.findAll('[data-testid="payer-toggle"]')[0].trigger('click');
    const options = wrapper.findAll('[data-testid="payer-option"]');
    expect(options).toHaveLength(1);
    expect(options[0].text()).toBe('Сам');
  });

  it('выбор плательщика эмитит setPaidBy', async () => {
    const anya = participant('Аня', { id: 'p-anya' });
    const timur = participant('Тимур', { id: 'p-timur' });
    const wrapper = mountDrawer({ participants: [anya, timur] });
    await wrapper.findAll('[data-testid="payer-toggle"]')[1].trigger('click');
    const options = wrapper.findAll('[data-testid="payer-option"]');
    await options[options.length - 1].trigger('click');
    expect(wrapper.emitted('setPaidBy')?.[0]).toEqual(['p-timur', 'p-anya']);
  });

  it('Enter в пустом поиске никого не добавляет', async () => {
    const wrapper = mountDrawer();
    await wrapper.find('input').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('add')).toBeUndefined();
  });

  it('тёзка добавленного контакта получает свою строку', () => {
    peopleRef.value = [contact('Иван')];
    const wrapper = mountDrawer({
      participants: [participant('Иван', { id: 'p-1' }), participant('Иван', { id: 'p-2' })],
    });
    // «Я» + строка контакта (первый Иван) + отдельная строка для второго
    const rows = wrapper.findAll('[data-testid="participant-row"]');
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.attributes('aria-pressed') === 'true')).toHaveLength(2);
  });

  it('кнопка «Готово» закрывает шторку', async () => {
    const wrapper = mountDrawer();
    await wrapper.find('[data-testid="participants-done"]').trigger('click');
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
  });
});
