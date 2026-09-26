import { describe, it, expect } from 'vitest';
import type { SharedDebtsPayload } from '@/entities/debt';
import { buildShareCaption } from './buildShareCaption';

function payload(over: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Азамат',
    currency: 'UZS',
    net: 1250000,
    totalGiven: 1250000,
    totalTaken: 0,
    ownerName: null,
    snapshotAt: Date.parse('2026-08-31'),
    debts: [],
    ...over,
  };
}

describe('buildShareCaption', () => {
  it('называет человека и итог в его пользу', () => {
    expect(buildShareCaption(payload())).toContain('Азамат — должен');
  });

  it('переворачивает формулировку, когда должны вы', () => {
    expect(buildShareCaption(payload({ net: -500000 }))).toContain('Азамат — вы должны');
  });

  it('печатает сумму без знака минус', () => {
    const caption = buildShareCaption(payload({ net: -500000 }));
    expect(caption).not.toContain('-');
    expect(caption).not.toContain('−');
  });

  // Номер сплошными цифрами: так его узнаёт автоопределение карты в мессенджере
  // и предлагает скопировать одним нажатием
  it('даёт номер карты сплошными цифрами', () => {
    expect(buildShareCaption(payload({ cardNumber: '8600123456789012' }))).toContain(
      'Карта: 8600123456789012',
    );
  });

  it('без приложенной карты остаётся одной строкой', () => {
    expect(buildShareCaption(payload()).split('\n')).toHaveLength(1);
  });

  it('не тащит в подпись список долгов', () => {
    const caption = buildShareCaption(
      payload({
        cardNumber: '8600123456789012',
        debts: [
          {
            title: 'Ремонт квартиры',
            direction: 'given',
            currency: 'UZS',
            totalAmount: 1500000,
            remainingAmount: 1350000,
            paidAmount: 150000,
            forgivenAmount: 0,
            dueDate: null,
            createdAt: '2026-08-01',
          },
        ],
      }),
    );
    expect(caption).not.toContain('Ремонт квартиры');
    expect(caption.split('\n')).toHaveLength(2);
  });
});
