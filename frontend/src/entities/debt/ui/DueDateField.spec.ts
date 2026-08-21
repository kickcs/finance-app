import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import DueDateField from './DueDateField.vue';

function mountField(modelValue: string | null = null) {
  return mount(DueDateField, {
    props: { modelValue },
    global: { stubs: { DatePickerField: true, UIcon: true } },
  });
}

const presets = (w: ReturnType<typeof mountField>) =>
  w.findAll('[data-testid="due-preset"]').map((b) => b.text());

describe('DueDateField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('показывает пресеты без срока, недели, двух недель и месяца', () => {
    expect(presets(mountField())).toEqual(['Без срока', 'Неделя', '2 недели', 'Месяц']);
  });

  it('«Неделя» отдаёт дату через семь дней', async () => {
    const wrapper = mountField();
    await wrapper.findAll('[data-testid="due-preset"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-08-03']);
  });

  it('«Месяц» отдаёт ту же дату следующего месяца', async () => {
    const wrapper = mountField();
    await wrapper.findAll('[data-testid="due-preset"]')[3].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-08-27']);
  });

  it('«Без срока» сбрасывает значение', async () => {
    const wrapper = mountField('2026-08-03');
    await wrapper.findAll('[data-testid="due-preset"]')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
  });

  it('подсвечивает пресет, совпавший с выбранной датой', () => {
    const week = mountField('2026-08-03').findAll('[data-testid="due-preset"]')[1];
    expect(week.attributes('aria-pressed')).toBe('true');
  });

  it('«Без срока» активен, когда даты нет', () => {
    const none = mountField().findAll('[data-testid="due-preset"]')[0];
    expect(none.attributes('aria-pressed')).toBe('true');
  });

  it('произвольную дату отдаёт чипу календаря, а не пресетам', () => {
    const wrapper = mountField('2026-12-31');
    expect(
      wrapper
        .findAll('[data-testid="due-preset"]')
        .every((b) => b.attributes('aria-pressed') === 'false'),
    ).toBe(true);
    expect(wrapper.findComponent({ name: 'DatePickerField' }).props('modelValue')).toBe(
      '2026-12-31',
    );
  });
});
