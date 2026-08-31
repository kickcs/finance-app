import { describe, it, expect, afterEach } from 'vitest';
import { stubCanvas2d, fakeContext, type Canvas2dStub } from '@/test/stubs/canvas2d';
import { CARD, bareAmount, fit, renderCard, type CardBody } from './shareCard';

let stub: Canvas2dStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
});

describe('fit', () => {
  it('не трогает строку, которая помещается', () => {
    expect(fit(fakeContext(), 'Ремонт', 200)).toBe('Ремонт');
  });

  it('не трогает строку без ограничения', () => {
    const long = 'Очень длинное название долга';
    expect(fit(fakeContext(), long, undefined)).toBe(long);
  });

  it('режет длинную строку до ширины и ставит многоточие', () => {
    const ctx = fakeContext();
    const out = fit(ctx, 'Первый взнос за квартиру в Юнусабаде', 70);
    expect(out.endsWith('…')).toBe(true);
    expect(ctx.measureText(out).width).toBeLessThanOrEqual(70);
  });

  it('не оставляет пробел перед многоточием', () => {
    expect(fit(fakeContext(), 'Такси в аэропорт сегодня', 70)).not.toMatch(/ …$/);
  });
});

describe('bareAmount', () => {
  it('группирует по три без символа валюты', () => {
    expect(bareAmount(1250000)).toBe('1 250 000');
    expect(bareAmount(999)).toBe('999');
  });
});

describe('renderCard', () => {
  it('меряет и рисует одним и тем же телом', () => {
    stub = stubCanvas2d();
    const passes: boolean[] = [];
    const body: CardBody = (_ctx, draw) => {
      passes.push(draw);
      return CARD.CARD_Y + 300;
    };

    const canvas = renderCard(body, 1);

    expect(passes).toEqual([false, true]);
    expect(canvas.width).toBe(CARD.W * 2);
  });

  it('высота холста следует за высотой тела', () => {
    stub = stubCanvas2d();
    const short = renderCard(() => CARD.CARD_Y + 200, 1).height;
    const tall = renderCard(() => CARD.CARD_Y + 400, 1).height;
    expect(tall - short).toBe(200 * 2);
  });

  it('подпись с адресом рисуется под листом', () => {
    stub = stubCanvas2d();
    renderCard(() => CARD.CARD_Y + 200, 1);
    const url = stub.calls.find((call) => call.text === 'app.ouro-finance.top');
    expect(url).toBeDefined();
    expect(url!.y).toBeGreaterThan(CARD.CARD_Y + 200);
  });
});
