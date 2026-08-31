import { describe, it, expect, afterEach } from 'vitest';
import { stubCanvas2d, type Canvas2dStub } from '@/test/stubs/canvas2d';
import type { ParticipantSummary, ParticipantSummaryItem } from './types';
import {
  buildChargesNote,
  renderReceiptCardToCanvas,
  type ReceiptShareData,
} from './renderReceiptCard';

function item(over: Partial<ParticipantSummaryItem> = {}): ParticipantSummaryItem {
  return { id: 'i', name: 'Плов', lineTotal: 100, share: 100, sharedWith: 1, ...over };
}

function participant(over: Partial<ParticipantSummary> = {}): ParticipantSummary {
  return {
    id: 'p',
    name: 'Азамат',
    isMe: false,
    color: '#F59E0B',
    itemCount: 1,
    total: 100,
    items: [item()],
    ...over,
  };
}

function data(over: Partial<ReceiptShareData> = {}): ReceiptShareData {
  return {
    storeName: 'Chorsu Bazaar',
    date: Date.parse('2026-08-29'),
    currency: 'UZS',
    totalAmount: 300,
    subtotal: 300,
    charges: [],
    chargesAmount: 0,
    participants: [participant({ id: 'me', name: 'Вы', isMe: true }), participant()],
    ...over,
  };
}

let stub: Canvas2dStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
});

describe('buildChargesNote', () => {
  it('без сборов — строки нет', () => {
    expect(buildChargesNote([], 0)).toBeNull();
  });

  it('выключенный сбор не считается', () => {
    const note = buildChargesNote(
      [{ id: '1', label: 'Сервисный сбор', enabled: false, type: 'percent', percent: 10 }],
      0,
    );
    expect(note).toBeNull();
  });

  it('процентный сбор', () => {
    const note = buildChargesNote(
      [{ id: '1', label: 'Сервисный сбор', enabled: true, type: 'percent', percent: 10 }],
      44200,
    );
    expect(note).toBe('Суммы включают 10% сервисный сбор');
  });

  it('сбор фиксированной суммой', () => {
    const note = buildChargesNote(
      [{ id: '1', label: 'Доставка', enabled: true, type: 'amount', amount: 15000 }],
      15000,
    );
    expect(note).toBe('Суммы включают 15 000 доставка');
  });
});

describe('renderReceiptCardToCanvas', () => {
  it('высота растёт с числом позиций участника', () => {
    stub = stubCanvas2d();
    const one = renderReceiptCardToCanvas(data()).height;
    const many = renderReceiptCardToCanvas(
      data({
        participants: [
          participant({ id: 'me', name: 'Вы', isMe: true }),
          participant({ items: [item(), item({ id: 'b' }), item({ id: 'c' })] }),
        ],
      }),
    ).height;
    expect(many).toBeGreaterThan(one);
  });

  it('называет сумму к возврату, а не только итог чека', () => {
    stub = stubCanvas2d();
    renderReceiptCardToCanvas(
      data({
        participants: [
          participant({ id: 'me', name: 'Вы', isMe: true, total: 156000 }),
          participant({ total: 198000 }),
          participant({ id: 'p2', name: 'Дилноза', total: 132000 }),
        ],
      }),
    );
    expect(stub.calls.map((call) => call.text)).toContain('вам вернут 330 000 UZS');
  });

  it('когда должников нет, карточка всё равно рисуется', () => {
    stub = stubCanvas2d();
    const canvas = renderReceiptCardToCanvas(
      data({ participants: [participant({ id: 'me', name: 'Вы', isMe: true })] }),
    );
    expect(canvas.height).toBeGreaterThan(0);
    expect(stub.calls.map((call) => call.text)).toContain('Никто ничего не должен');
  });

  it('доля общей позиции подписана в названии', () => {
    stub = stubCanvas2d();
    renderReceiptCardToCanvas(
      data({
        participants: [
          participant({ id: 'me', name: 'Вы', isMe: true }),
          participant({ items: [item({ name: 'Ачик-чучук', sharedWith: 2, share: 50 })] }),
        ],
      }),
    );
    expect(stub.calls.map((call) => call.text)).toContain('Ачик-чучук · 1/2');
  });

  it('примечание о сборах рисуется последним блоком', () => {
    stub = stubCanvas2d();
    renderReceiptCardToCanvas(
      data({
        charges: [
          { id: '1', label: 'Сервисный сбор', enabled: true, type: 'percent', percent: 10 },
        ],
        chargesAmount: 30,
      }),
    );
    const note = stub.calls.find((call) => call.text.startsWith('Суммы включают'));
    const name = stub.calls.find((call) => call.text === 'Азамат');
    expect(note).toBeDefined();
    expect(note!.y).toBeGreaterThan(name!.y);
  });
});
