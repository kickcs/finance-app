import { existsSync } from 'fs';
import { join } from 'path';
import { Resvg } from '@resvg/resvg-js';
import {
  OG,
  SHARE_DISPLAY,
  SHARE_FONT_FILES,
  SHARE_MONO,
  ogCardHeight,
  ogHero,
  ogLayout,
  ogRows,
  plural,
  shortDate,
} from './share-card.svg';

function render(svg: string): Buffer {
  return new Resvg(svg, {
    font: { fontFiles: SHARE_FONT_FILES, loadSystemFonts: false, defaultFontFamily: SHARE_DISPLAY },
  })
    .render()
    .asPng();
}

describe('шрифты карточек', () => {
  it('все пять файлов лежат на месте', () => {
    expect(SHARE_FONT_FILES).toHaveLength(5);
    for (const file of SHARE_FONT_FILES) expect(existsSync(file)).toBe(true);
  });

  it('DejaVu больше не нужен', () => {
    expect(existsSync(join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'))).toBe(false);
  });

  // Если resvg не различает начертания одного семейства, обе картинки совпадут,
  // и разница весов всплыла бы только в проде.
  it('различает вес 500 и 800 внутри одного семейства', () => {
    const svg = (w: number) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><text x="10" y="40" font-family="${SHARE_DISPLAY}" font-size="32" font-weight="${w}">Сверка</text></svg>`;
    expect(render(svg(500)).equals(render(svg(800)))).toBe(false);
  });

  it('рисует моноширинным семейством', () => {
    const svg = (family: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><text x="10" y="40" font-family="${family}" font-size="32">1 250 000</text></svg>`;
    expect(render(svg(SHARE_MONO)).equals(render(svg(SHARE_DISPLAY)))).toBe(false);
  });
});

describe('plural', () => {
  it('склоняет по-русски', () => {
    expect(plural(1, 'позиция', 'позиции', 'позиций')).toBe('позиция');
    expect(plural(2, 'позиция', 'позиции', 'позиций')).toBe('позиции');
    expect(plural(5, 'позиция', 'позиции', 'позиций')).toBe('позиций');
    expect(plural(11, 'позиция', 'позиции', 'позиций')).toBe('позиций');
    expect(plural(21, 'позиция', 'позиции', 'позиций')).toBe('позиция');
  });
});

describe('shortDate', () => {
  it('год двумя цифрами', () => {
    expect(shortDate(Date.parse('2026-08-31T12:00:00Z'))).toBe('31.08.26');
  });

  it('мусор превращается в пустую строку, а не в NaN', () => {
    expect(shortDate('не дата')).toBe('');
  });
});

describe('ogCardHeight', () => {
  it('растёт с числом строк', () => {
    expect(ogCardHeight(3, false)).toBeGreaterThan(ogCardHeight(1, false));
  });

  it('больше трёх строк не показываем, но место под «и ещё» добавляем', () => {
    expect(ogCardHeight(9, true)).toBe(ogCardHeight(3, false) + 34);
  });

  it('никогда не выше холста', () => {
    expect(ogCardHeight(9, true)).toBeLessThanOrEqual(OG.H);
  });

  it('пустой список не даёт отрицательной высоты', () => {
    expect(ogCardHeight(0, false)).toBe(ogCardHeight(1, false));
  });
});

describe('ogLayout', () => {
  it('центрирует бумагу по холсту', () => {
    expect(ogLayout(400).y).toBe((OG.H - 400) / 2);
  });
});

describe('ogRows', () => {
  const row = (title: string, color = '#F59E0B') => ({
    color,
    title,
    sub: 'без срока',
    amount: '1 000',
    unit: ['долг', 'долга', 'долгов'] as [string, string, string],
  });

  it('режет длинное название — в SVG измерить текст нечем', () => {
    const svg = ogRows([row('Первый взнос за квартиру в Юнусабаде')], 300);
    expect(svg).toContain('…');
    expect(svg).not.toContain('Юнусабаде');
  });

  it('показывает не больше трёх строк и считает остаток', () => {
    const svg = ogRows([row('а'), row('б'), row('в'), row('г'), row('д')], 300);
    expect(svg).toContain('и ещё 2 долга');
  });

  it('экранирует разметку в данных', () => {
    const svg = ogRows([row('<script>')], 300);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('подставляет запасной цвет вместо мусора в поле цвета', () => {
    expect(ogRows([row('Плов', 'javascript:alert(1)')], 300)).not.toContain('javascript:');
  });
});

describe('ogHero', () => {
  it('валюта — tspan в том же text, ширину считает рендерер', () => {
    const svg = ogHero({
      y: 60,
      subject: 'Азамат',
      amount: '+1 250 000',
      currency: 'UZS',
      color: '#C2620A',
      caption: 'должен вам',
    });
    expect(svg).toMatch(/<tspan[^>]*>UZS<\/tspan>/);
  });
});
