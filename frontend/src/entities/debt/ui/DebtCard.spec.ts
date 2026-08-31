import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DebtCard from './DebtCard.vue';
import { makeDebt } from '@/test/fixtures/debt';
import type { Debt } from '@/shared/api/database.types';

function mountCard(debt: Debt, props: Record<string, unknown> = {}) {
  return mount(DebtCard, { props: { debt, ...props } });
}

const bar = (w: ReturnType<typeof mountCard>) => w.findComponent({ name: 'UProgressBar' });
const bars = (w: ReturnType<typeof mountCard>) => w.findAllComponents({ name: 'UProgressBar' });

describe('DebtCard — открытый долг', () => {
  it('показывает остаток, направление и полосу погашения', () => {
    const w = mountCard(makeDebt({ total_amount: 1000, remaining_amount: 400 }));

    expect(w.text()).toContain('Вам должны');
    expect(w.text()).toContain('400');
    expect(w.text()).not.toContain('Погашен');
    expect(bar(w).props('value')).toBe(60);
  });

  it('красит полосу цветом направления, а не дефолтным primary', () => {
    expect(bar(mountCard(makeDebt({ remaining_amount: 400 }))).props('color')).toBe(
      'var(--color-debt-given)',
    );
    expect(
      bar(mountCard(makeDebt({ debt_type: 'taken', remaining_amount: 400 }))).props('color'),
    ).toBe('var(--color-debt-received)');
  });

  it('просроченный долг подсвечен опасностью целиком — фон, дата и полоса', () => {
    const w = mountCard(makeDebt({ next_payment_date: '2020-01-01', remaining_amount: 400 }));

    expect(w.get('button').classes().join(' ')).toContain('border-danger');
    expect(bar(w).props('color')).toBe('danger');
  });

  it('скрытый долг не показывает ни имени, ни суммы — в том числе для чтения с экрана', () => {
    const w = mountCard(makeDebt({ is_private: true, remaining_amount: 400 }));

    expect(w.text()).not.toContain('Азиз');
    expect(w.text()).not.toContain('400');
    expect(w.get('button').attributes('aria-label')).toBe('Вам должны, скрытый долг');
  });

  it('клик по строке отдаётся наружу', async () => {
    const w = mountCard(makeDebt());
    await w.get('button').trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });
});

describe('DebtCard — погашенный долг', () => {
  const closed = makeDebt({
    is_closed: true,
    remaining_amount: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    closed_at: '2026-01-11T00:00:00.000Z',
  });

  it('показывает полную сумму долга и метку погашения', () => {
    const w = mountCard(closed);

    expect(w.text()).toContain('Погашен');
    expect(w.text()).toContain('1');
    expect(w.get('button').attributes('aria-label')).toContain('погашен');
  });

  it('прощённый долг отличается меткой и тоном ленты', () => {
    const w = mountCard(makeDebt({ ...closed, forgiven_amount: 600 }));

    expect(w.text()).toContain('Прощён');
    expect(bar(w).props('color')).toBe('warning');
  });

  it('оплаченный долг красит ленту успехом', () => {
    expect(bar(mountCard(closed)).props('color')).toBe('success');
  });

  it('лента жизни занимает одну полосу — прогресс погашения ей не дублируется', () => {
    expect(bars(mountCard(closed))).toHaveLength(1);
  });

  it('подписывает, сколько дней долг прожил', () => {
    expect(mountCard(closed).text()).toContain('10 дн.');
  });

  it('чужую валюту подписывает рядом с суммой, свою — нет', () => {
    const badge = (w: ReturnType<typeof mountCard>) => w.find('[data-testid="debt-card-currency"]');

    expect(
      badge(mountCard(makeDebt({ ...closed, currency: 'USD' }), { userCurrency: 'UZS' })).text(),
    ).toBe('USD');
    expect(badge(mountCard(closed, { userCurrency: 'UZS' })).exists()).toBe(false);
  });
});
