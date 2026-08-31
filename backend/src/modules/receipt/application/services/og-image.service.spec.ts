import { Resvg } from '@resvg/resvg-js';
import { SHARE_DISPLAY, SHARE_FONT_FILES } from '../../../../shared/utils/share-card.svg';
import { buildOgSvg } from './og-image.service';
import type { SharedReceiptPayload } from './shared-receipt.service';

type Participant = SharedReceiptPayload['participants'][number];

function item(name = 'Плов'): Participant['items'][number] {
  return { name, share: 100, sharedWith: 1, lineTotal: 100 };
}

function participant(over: Partial<Participant> = {}): Participant {
  return {
    name: 'Азамат',
    color: '#F59E0B',
    isMe: false,
    total: 198000,
    paidByName: null,
    items: [item(), item('Лагман'), item('Ачик-чучук')],
    ...over,
  };
}

function payload(over: Partial<SharedReceiptPayload> = {}): SharedReceiptPayload {
  return {
    storeName: 'Chorsu Bazaar',
    date: Date.parse('2026-08-29'),
    currency: 'UZS',
    totalAmount: 486000,
    subtotal: 486000,
    charges: [],
    participants: [
      participant({ name: 'Вы', isMe: true, total: 156000 }),
      participant(),
      participant({ name: 'Дилноза', color: '#10B981', total: 132000, items: [item(), item()] }),
    ],
    paymentMethods: [],
    ownerName: null,
    ...over,
  };
}

describe('buildOgSvg', () => {
  it('называет сумму к возврату, а не только итог чека', () => {
    expect(buildOgSvg(payload())).toContain('вам вернут 330 000 UZS');
  });

  it('плательщик своей строки в списке не занимает', () => {
    const svg = buildOgSvg(payload());
    expect(svg).toContain('Дилноза');
    expect(svg).not.toContain('>Вы<');
  });

  it('склоняет число позиций', () => {
    const svg = buildOgSvg(payload());
    expect(svg).toContain('3 позиции');
    expect(svg).toContain('2 позиции');
  });

  it('склоняет единственное число', () => {
    const svg = buildOgSvg(
      payload({
        participants: [
          participant({ name: 'Вы', isMe: true, total: 0 }),
          participant({ items: [item()] }),
        ],
      }),
    );
    expect(svg).toContain('1 позиция');
  });

  it('подставляет запасной цвет вместо мусора в поле цвета', () => {
    const svg = buildOgSvg(
      payload({
        participants: [
          participant({ name: 'Вы', isMe: true, total: 0 }),
          participant({ color: 'javascript:alert(1)' }),
        ],
      }),
    );
    expect(svg).not.toContain('javascript:');
  });

  it('когда делить не с кем, карточка всё равно собирается', () => {
    const svg = buildOgSvg(
      payload({ participants: [participant({ name: 'Вы', isMe: true, total: 156000 })] }),
    );
    expect(svg).toContain('делить не с кем');
  });

  it('resvg рендерит результат в непустой PNG', () => {
    const png = new Resvg(buildOgSvg(payload()), {
      font: {
        fontFiles: SHARE_FONT_FILES,
        loadSystemFonts: false,
        defaultFontFamily: SHARE_DISPLAY,
      },
    })
      .render()
      .asPng();
    expect(png.length).toBeGreaterThan(10000);
  });
});
