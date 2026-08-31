import { Resvg } from '@resvg/resvg-js';
import { SHARE_DISPLAY, SHARE_FONT_FILES } from '../../../../shared/utils/share-card.svg';
import { buildDebtsOgSvg } from './debts-og-image.service';
import type { SharedDebtEntry, SharedDebtsPayload } from './shared-debts.service';

function debt(over: Partial<SharedDebtEntry> = {}): SharedDebtEntry {
  return {
    title: 'Ремонт квартиры',
    direction: 'given',
    currency: 'UZS',
    totalAmount: 1500000,
    remainingAmount: 1350000,
    paidAmount: 150000,
    forgivenAmount: 0,
    dueDate: '2026-09-12',
    createdAt: '2026-08-01',
    ...over,
  };
}

function payload(over: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Азамат Рахимов',
    currency: 'UZS',
    net: 1250000,
    totalGiven: 2100000,
    totalTaken: 850000,
    ownerName: null,
    snapshotAt: Date.parse('2026-08-31'),
    debts: [debt()],
    ...over,
  };
}

/** Верхняя точка рваного края: чем ниже начинается лист, тем он короче. */
function paperTop(svg: string): number {
  return Number(/M76 ([\d.]+)/.exec(svg)![1]);
}

describe('buildDebtsOgSvg', () => {
  it('при встречных долгах показывает обе стороны — нетто иначе не проверить', () => {
    const svg = buildDebtsOgSvg(payload());
    expect(svg).toContain('вам должны 2 100 000');
    expect(svg).toContain('вы должны 850 000');
  });

  it('при одностороннем долге — прежняя формулировка', () => {
    const svg = buildDebtsOgSvg(payload({ totalGiven: 1000, totalTaken: 0, net: 1000 }));
    expect(svg).toContain('должен вам');
    expect(svg).not.toContain('вам должны');
  });

  it('долг с вас окрашен в фиолетовый, а не в оранжевый', () => {
    const svg = buildDebtsOgSvg(payload({ net: -500000, totalGiven: 0, totalTaken: 500000 }));
    expect(svg).toContain('−500 000');
    expect(svg).toContain('#7E22CE');
  });

  it('смешанные валюты — валюта в каждой строке', () => {
    const svg = buildDebtsOgSvg(
      payload({ debts: [debt(), debt({ currency: 'USD', remainingAmount: 100 })] }),
    );
    expect(svg).toContain('100 USD');
  });

  it('однородные валюты — голые числа', () => {
    expect(buildDebtsOgSvg(payload())).not.toContain('1 350 000 UZS');
  });

  it('высота бумаги растёт с числом долгов', () => {
    const one = buildDebtsOgSvg(payload({ debts: [debt()] }));
    const three = buildDebtsOgSvg(payload({ debts: [debt(), debt(), debt()] }));
    expect(paperTop(three)).toBeLessThan(paperTop(one));
  });

  it('длинное название режется, а не наезжает на сумму', () => {
    const svg = buildDebtsOgSvg(
      payload({ debts: [debt({ title: 'Первый взнос за квартиру в Юнусабаде' })] }),
    );
    expect(svg).toContain('…');
    expect(svg).not.toContain('Юнусабаде');
  });

  it('один снимок всегда даёт один и тот же SVG', () => {
    expect(buildDebtsOgSvg(payload())).toBe(buildDebtsOgSvg(payload()));
  });

  it('пустой список долгов не роняет разметку', () => {
    const svg = buildDebtsOgSvg(payload({ debts: [] }));
    expect(paperTop(svg)).toBeGreaterThan(0);
  });

  it('resvg рендерит результат в непустой PNG', () => {
    const png = new Resvg(buildDebtsOgSvg(payload()), {
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
