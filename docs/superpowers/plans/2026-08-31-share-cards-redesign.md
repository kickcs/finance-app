# Редизайн картинок шаринга — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести четыре картинки шаринга (canvas-карточки долгов и чека, два OG-превью 1200×630) к единому визуальному языку «расписки» и попутно починить найденные макетом баги вёрстки.

**Architecture:** Общая оболочка карточки живёт в `shared`: на фронте — `shared/lib/share/shareCard.ts` (токены, примитивы, двухпроходный рендер), на бэкенде — `shared/utils/share-card.svg.ts` (примитивы SVG). Каждая из четырёх карточек описывает только своё тело. Шрифты — Golos Text + IBM Plex Mono, самостоятельно хостятся, на фронте грузятся лениво мимо precache.

**Tech Stack:** Vue 3 + vitest (frontend), NestJS + jest + `@resvg/resvg-js` 2.6 (backend), fonttools (разовая генерация шрифтов).

**Spec:** `docs/superpowers/specs/2026-08-31-share-cards-redesign-design.md`

## Global Constraints

- Палитра — ровно токены из спеки; никаких новых цветов
- Шрифты — Golos Text 500/600/800 и IBM Plex Mono 500/600, больше начертаний не добавлять
- Frontend-шрифты лежат в `frontend/public/share-fonts/`, НЕ в `src` и НЕ в выходном `fonts/` — иначе `appShellPrecachePlugin.ts` (`ALWAYS_PRECACHED`, `/^fonts\/.+\.woff2$/`) форсит их в precache
- Сабсет обязан включать `U+00A0`, `U+00B7`, `U+2026`, `U+2212`, `U+0401`, `U+0451`
- Форма рваного края детерминирована: PRNG сеется датой снимка, одни данные → одна картинка
- Комментарии в коде — коротко, одна-две строки, про «почему так»
- Тексты карточек на русском
- Коммиты без `Co-Authored-By`

---

### Task 1: Шрифты — генерация, размещение, кэширование

**Files:**
- Create: `scripts/build-share-fonts.py`
- Create: `frontend/public/share-fonts/golos-500.woff2`, `golos-600.woff2`, `golos-800.woff2`, `plex-mono-500.woff2`, `plex-mono-600.woff2`
- Create: `backend/assets/fonts/golos-500.ttf`, `golos-600.ttf`, `golos-800.ttf`, `plex-mono-500.ttf`, `plex-mono-600.ttf`
- Delete: `backend/assets/fonts/DejaVuSans.ttf`, `backend/assets/fonts/DejaVuSans-Bold.ttf`
- Modify: `frontend/vite.config.ts` (правило `runtimeCaching` для `/share-fonts/`)
- Test: `backend/src/shared/utils/share-fonts.spec.ts`

**Interfaces:**
- Produces: пять woff2 в `frontend/public/share-fonts/`; пять ttf в `backend/assets/fonts/`; семейства в name-таблице — `Golos Text` и `IBM Plex Mono`, `usWeightClass` 500/600/800 и 500/600 соответственно

- [ ] **Step 1: Написать скрипт генерации**

Создать `scripts/build-share-fonts.py`:

```python
#!/usr/bin/env python3
"""
Пересобирает шрифты карточек шаринга из вариативных исходников Google Fonts.

Запускается вручную при смене шрифта; результат коммитится. Нужен fonttools:
    pip install 'fonttools[woff]' brotli

    python3 scripts/build-share-fonts.py
"""
import io
import pathlib
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.subset import Subsetter, Options

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "frontend" / "public" / "share-fonts"
NATIVE = ROOT / "backend" / "assets" / "fonts"

GOLOS_VF = "https://raw.githubusercontent.com/google/fonts/main/ofl/golostext/GolosText%5Bwght%5D.ttf"
PLEX = "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-{}.ttf"

# Ровно то, что карточки рисуют. U+00A0 — им Intl.NumberFormat разделяет разряды,
# U+2212 — минус в сумме-герое, U+2026 — многоточие обрезки, U+00B7 — разделитель.
UNICODES = (
    "U+0020-007E,U+00A0,U+00A2-00A5,U+00B7,"
    "U+0400-045F,U+0490-0491,"
    "U+2013,U+2014,U+2026,U+2116,U+2212,"
    "U+20AC,U+20B4,U+20B8,U+20BD"
)


def fetch(url: str) -> bytes:
    print(f"  ← {url}")
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def subset(font: TTFont) -> TTFont:
    opts = Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = Subsetter(options=opts)
    s.populate(unicodes=[
        int(part.split("-")[0][2:], 16) if "-" not in part
        else 0  # диапазоны разворачиваем ниже
        for part in []
    ])
    # Subsetter принимает готовый список кодпоинтов — собираем его из UNICODES
    codepoints = []
    for part in UNICODES.split(","):
        part = part[2:]
        if "-" in part:
            lo, hi = part.split("-")
            codepoints.extend(range(int(lo, 16), int(hi, 16) + 1))
        else:
            codepoints.append(int(part, 16))
    s = Subsetter(options=opts)
    s.populate(unicodes=codepoints)
    s.subset(font)
    return font


def emit(font: TTFont, stem: str) -> None:
    font.flavor = None
    native = NATIVE / f"{stem}.ttf"
    font.save(native)
    font.flavor = "woff2"
    web = WEB / f"{stem}.woff2"
    font.save(web)
    print(f"  → {native.name} {native.stat().st_size // 1024} КБ"
          f" · {web.name} {web.stat().st_size // 1024} КБ")


def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    NATIVE.mkdir(parents=True, exist_ok=True)

    print("Golos Text")
    golos_src = fetch(GOLOS_VF)
    for weight in (500, 600, 800):
        vf = TTFont(io.BytesIO(golos_src))
        static = instancer.instantiateVariableFont(vf, {"wght": weight}, updateFontNames=True)
        emit(subset(static), f"golos-{weight}")

    print("IBM Plex Mono")
    for weight, name in ((500, "Medium"), (600, "SemiBold")):
        f = TTFont(io.BytesIO(fetch(PLEX.format(name))))
        emit(subset(f), f"plex-mono-{weight}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Прогнать скрипт и убедиться, что файлы на месте**

Run:
```bash
pip3 install --quiet 'fonttools[woff]' brotli
python3 scripts/build-share-fonts.py
ls -la frontend/public/share-fonts/ backend/assets/fonts/
```
Expected: пять `.woff2` и пять `.ttf`, каждый меньше 60 КБ.

- [ ] **Step 3: Удалить DejaVu**

```bash
git rm backend/assets/fonts/DejaVuSans.ttf backend/assets/fonts/DejaVuSans-Bold.ttf
```

- [ ] **Step 4: Написать падающий тест на подбор начертаний**

Создать `backend/src/shared/utils/share-fonts.spec.ts`:

```ts
import { existsSync } from 'fs';
import { join } from 'path';
import { Resvg } from '@resvg/resvg-js';
import { SHARE_FONT_FILES, SHARE_DISPLAY, SHARE_MONO } from './share-card.svg';

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
    for (const f of SHARE_FONT_FILES) expect(existsSync(f)).toBe(true);
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
    const svg = (f: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><text x="10" y="40" font-family="${f}" font-size="32">1 250 000</text></svg>`;
    expect(render(svg(SHARE_MONO)).equals(render(svg(SHARE_DISPLAY)))).toBe(false);
  });
});
```

- [ ] **Step 5: Запустить тест — должен упасть**

Run: `cd backend && bun run test -- share-fonts`
Expected: FAIL, `Cannot find module './share-card.svg'` — модуль появится в Task 5.

- [ ] **Step 6: Добавить правило runtime-кэша**

В `frontend/vite.config.ts`, в массив `runtimeCaching`, после правила `route-chunks`:

```ts
          {
            // Шрифты карточек шаринга. Лежат в public/share-fonts, а не в
            // выходном fonts/, потому что ALWAYS_PRECACHED в
            // appShellPrecachePlugin форсит любой fonts/*.woff2 в precache —
            // а первой отрисовке они не нужны. Имена нехешированные, поэтому
            // смена шрифта требует переименования файла.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/share-fonts/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'share-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
```

- [ ] **Step 7: Коммит**

```bash
git add scripts/build-share-fonts.py frontend/public/share-fonts backend/assets/fonts \
        frontend/vite.config.ts backend/src/shared/utils/share-fonts.spec.ts
git commit -m "chore(share): шрифты карточек — Golos Text и IBM Plex Mono вместо DejaVu"
```

---

### Task 2: Оболочка карточки на фронте

**Files:**
- Modify: `frontend/src/shared/lib/share/shareCard.ts` (полностью переписать)
- Create: `frontend/src/shared/lib/share/shareFonts.ts`
- Test: `frontend/src/shared/lib/share/shareCard.spec.ts`

**Interfaces:**
- Consumes: файлы из Task 1 по адресам `/share-fonts/*.woff2`
- Produces:
  - `SHARE_COLORS` — объект с ключами `ground, rule, paper, ink, inkSoft, inkFaint, hairline, perf, goldText, gold1, gold2, givenText, givenRail, takenText, takenRail`
  - `DISPLAY: string`, `MONO: string` — значения для `ctx.font`
  - `CARD: { W, MARGIN, CARD_W, PAD, CX, CR, CW, GUTTER, TEAR_AMP, CARD_Y }`
  - `fit(ctx: CanvasRenderingContext2D, str: string, max?: number): string`
  - `text(ctx, str, x, y, opts: { font: string; color: string; align?: CanvasTextAlign; track?: number; max?: number }): void`
  - `measure(ctx, str, font, track?): number`
  - `drawMark(ctx, cx, cy, size): void`
  - `drawTear(ctx, y): void`
  - `rail(ctx, x, y, h, color): void`
  - `eyebrow(ctx, draw: boolean, rightLabel: string): number`
  - `hero(ctx, draw: boolean, y: number, amount: string, currency: string, color: string): void`
  - `type CardBody = (ctx: CanvasRenderingContext2D, draw: boolean) => number`
  - `renderCard(body: CardBody, seed: number): HTMLCanvasElement`
  - `ensureShareFonts(): Promise<void>` (из `shareFonts.ts`)
  - сохраняются как есть: `APP_URL`, `canvasToBlob`, `downloadBlob`, `buildShareFilename`

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/shared/lib/share/shareCard.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fit, renderCard, CARD, type CardBody } from './shareCard';

/** jsdom не рисует, но measureText нужен — подменяем на пропорцию от длины. */
function stubCtx(): CanvasRenderingContext2D {
  return {
    font: '',
    letterSpacing: '0px',
    measureText: (s: string) => ({ width: s.length * 7 }),
  } as unknown as CanvasRenderingContext2D;
}

describe('fit', () => {
  it('не трогает строку, которая помещается', () => {
    expect(fit(stubCtx(), 'Ремонт', 200)).toBe('Ремонт');
  });

  it('не трогает строку без ограничения', () => {
    expect(fit(stubCtx(), 'Очень длинное название долга', undefined)).toBe(
      'Очень длинное название долга',
    );
  });

  it('режет длинную строку до ширины и ставит многоточие', () => {
    const ctx = stubCtx();
    const out = fit(ctx, 'Первый взнос за квартиру в Юнусабаде', 70);
    expect(out.endsWith('…')).toBe(true);
    expect(ctx.measureText(out).width).toBeLessThanOrEqual(70);
  });

  it('не оставляет пробел перед многоточием', () => {
    expect(fit(stubCtx(), 'Такси в аэропорт сегодня', 70)).not.toMatch(/ …$/);
  });
});

describe('renderCard', () => {
  it('меряет и рисует одним и тем же телом, высота совпадает', () => {
    const calls: boolean[] = [];
    const body: CardBody = (_ctx, draw) => {
      calls.push(draw);
      return CARD.CARD_Y + 300;
    };
    const canvas = renderCard(body, 1);
    expect(calls).toEqual([false, true]);
    expect(canvas.width).toBe(CARD.W * 2);
    expect(canvas.height).toBeGreaterThan(300 * 2);
  });

  it('одна и та же дата даёт ту же форму рваного края', () => {
    const body: CardBody = () => CARD.CARD_Y + 200;
    const a = renderCard(body, 42).toDataURL();
    const b = renderCard(body, 42).toDataURL();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd frontend && bun run test -- shareCard`
Expected: FAIL, `fit` не экспортируется.

- [ ] **Step 3: Написать `shareFonts.ts`**

Создать `frontend/src/shared/lib/share/shareFonts.ts`:

```ts
/**
 * Шрифты карточек шаринга. Грузятся лениво, в момент первого рендера: первой
 * отрисовке приложения они не нужны, а в стартовом бюджете весят заметно.
 */
const FACES: Array<[family: string, weight: string, file: string]> = [
  ['Golos Text', '500', 'golos-500.woff2'],
  ['Golos Text', '600', 'golos-600.woff2'],
  ['Golos Text', '800', 'golos-800.woff2'],
  ['IBM Plex Mono', '500', 'plex-mono-500.woff2'],
  ['IBM Plex Mono', '600', 'plex-mono-600.woff2'],
];

let pending: Promise<void> | null = null;

/**
 * До готовности шрифтов рисовать нельзя: canvas молча подставит системный, и
 * все замеры ширины уедут. Промис кэшируется — карточку рисуют по многу раз.
 */
export function ensureShareFonts(): Promise<void> {
  if (pending) return pending;

  // jsdom и старые webview без FontFace: рендер просто пойдёт системным шрифтом
  if (typeof FontFace === 'undefined' || !document.fonts) {
    pending = Promise.resolve();
    return pending;
  }

  pending = Promise.all(
    FACES.map(async ([family, weight, file]) => {
      const face = new FontFace(family, `url(/share-fonts/${file})`, { weight });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => undefined)
    .catch(() => undefined);

  return pending;
}
```

- [ ] **Step 4: Переписать `shareCard.ts`**

Заменить содержимое `frontend/src/shared/lib/share/shareCard.ts` целиком:

```ts
/**
 * Оболочка «карточек для шаринга» — картинок, которые пользователь отправляет в
 * мессенджер вместо скриншота экрана.
 *
 * Карточка — лист бумаги на подложке: рваный сверху край, линия отрыва с
 * вырезами, разлинованный «стол» вокруг. Подложка своя и непрозрачная — иначе
 * в вырезы просвечивал бы фон мессенджера. Светлая независимо от темы
 * приложения: её смотрят в чужой ленте.
 */

export const SHARE_SCALE = 2;

export const SHARE_COLORS = {
  ground: '#E6E9F0',
  rule: 'rgba(20,24,40,0.055)',
  paper: '#FFFFFF',
  ink: '#141418',
  inkSoft: '#565B6B',
  inkFaint: '#98A0B0',
  hairline: '#E2E6EC',
  perf: '#C6CDD9',
  goldText: '#96691C',
  gold1: '#C59B3F',
  gold2: '#E8C865',
  givenText: '#C2620A',
  givenRail: '#F59E0B',
  takenText: '#7E22CE',
  takenRail: '#A855F7',
} as const;

export const DISPLAY = '"Golos Text", -apple-system, BlinkMacSystemFont, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

export const APP_NAME = 'OURO FINANCE';
export const APP_URL = 'app.ouro-finance.top';

const W = 480;
const MARGIN = 20;
const CARD_W = W - MARGIN * 2;
const PAD = 24;

export const CARD = {
  W,
  MARGIN,
  CARD_W,
  PAD,
  CX: MARGIN + PAD,
  CR: MARGIN + CARD_W - PAD,
  CW: CARD_W - PAD * 2,
  GUTTER: 15,
  TEAR_AMP: 6,
  CARD_Y: 16,
} as const;

export type CardBody = (ctx: CanvasRenderingContext2D, draw: boolean) => number;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Рваный край: зубцы неравной глубины, изредка укус вдвое глубже. Ровная пила
 * читалась бы как декор. Форма сеется датой снимка — одни данные дают одну
 * картинку.
 */
function tearPoints(x: number, w: number, amp: number, seed: number): Array<[number, number]> {
  const rng = mulberry32(seed);
  const pts: Array<[number, number]> = [[x, amp * 0.5]];
  let px = x;
  while (px < x + w) {
    px = Math.min(px + 4 + rng() * 5, x + w);
    pts.push([px, rng() * amp * (rng() < 0.18 ? 1.7 : 1)]);
  }
  return pts;
}

function cardPath(ctx: CanvasRenderingContext2D, h: number, seed: number): void {
  const { MARGIN: x, CARD_Y: y, CARD_W: w, TEAR_AMP } = CARD;
  const r = 16;
  ctx.beginPath();
  const pts = tearPoints(x, w, TEAR_AMP, seed);
  ctx.moveTo(pts[0][0], y + pts[0][1]);
  for (const [px, dy] of pts) ctx.lineTo(px, y + dy);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.closePath();
}

/**
 * maxWidth у fillText не обрезает, а сплющивает глифы по горизонтали — на
 * длинном названии это читается как сломанный шрифт. Режем сами.
 */
export function fit(ctx: CanvasRenderingContext2D, str: string, max?: number): string {
  if (max === undefined || ctx.measureText(str).width <= max) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${str.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${str.slice(0, lo).trimEnd()}…`;
}

interface TextOptions {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  track?: number;
  max?: number;
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  { font, color, align = 'left', track = 0, max }: TextOptions,
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = track ? `${track}px` : '0px';
  ctx.fillText(fit(ctx, str, max), x, y);
  ctx.letterSpacing = '0px';
}

export function measure(
  ctx: CanvasRenderingContext2D,
  str: string,
  font: string,
  track = 0,
): number {
  ctx.font = font;
  ctx.letterSpacing = track ? `${track}px` : '0px';
  const w = ctx.measureText(str).width;
  ctx.letterSpacing = '0px';
  return w;
}

/** Кольцо-ороборос — единственное место, где живёт золотой градиент. */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  const r = size / 2;
  ctx.beginPath();
  ctx.fillStyle = SHARE_COLORS.ink;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, SHARE_COLORS.gold1);
  g.addColorStop(0.5, SHARE_COLORS.gold2);
  g.addColorStop(1, SHARE_COLORS.gold1);
  ctx.beginPath();
  ctx.strokeStyle = g;
  ctx.lineWidth = size * 0.17;
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

/** Линия отрыва: перфорация между вырезами, прогрызенными до подложки. */
export function drawTear(ctx: CanvasRenderingContext2D, y: number): void {
  const { MARGIN: x, CARD_W: w } = CARD;
  ctx.save();
  ctx.fillStyle = SHARE_COLORS.ground;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w, y, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.setLineDash([1.5, 6]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = SHARE_COLORS.perf;
  ctx.lineWidth = 2;
  ctx.moveTo(x + 17, y);
  ctx.lineTo(x + w - 17, y);
  ctx.stroke();
  ctx.restore();
}

/** Вертикальная плашка в жёлобе: у долга кодирует направление, у участника — его цвет. */
export function rail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 3, h, 1.5);
  ctx.fill();
}

/** Бровь листа: марка, название и дата снимка. Возвращает y волосяной линии. */
export function eyebrow(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  rightLabel: string,
): number {
  const { CX, CR, CARD_Y, TEAR_AMP } = CARD;
  const y = CARD_Y + TEAR_AMP + 9;
  if (draw) {
    drawMark(ctx, CX + 9, y + 8, 18);
    text(ctx, APP_NAME, CX + 26, y + 12, {
      font: `600 11px ${DISPLAY}`,
      color: SHARE_COLORS.goldText,
      track: 1.6,
    });
    text(ctx, rightLabel, CR, y + 12, {
      font: `500 11px ${MONO}`,
      color: SHARE_COLORS.inkFaint,
      align: 'right',
    });
    ctx.beginPath();
    ctx.strokeStyle = SHARE_COLORS.hairline;
    ctx.lineWidth = 1;
    ctx.moveTo(CX, y + 28.5);
    ctx.lineTo(CR, y + 28.5);
    ctx.stroke();
  }
  return y + 28;
}

/** Сумма-герой: валюта мельче и тише, иначе съедает ширину у самих цифр. */
export function hero(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  y: number,
  amount: string,
  currency: string,
  color: string,
): void {
  if (!draw) return;
  const font = `800 38px ${DISPLAY}`;
  const w = measure(ctx, amount, font, -0.8);
  text(ctx, amount, CARD.CX, y, { font, color, track: -0.8 });
  text(ctx, currency, CARD.CX + w + 7, y, {
    font: `600 17px ${DISPLAY}`,
    color: SHARE_COLORS.inkSoft,
  });
}

/**
 * Тело карточки описывается один раз и вызывается дважды: сначала на замер,
 * потом на отрисовку. Отдельная формула высоты расходилась бы с рисованием при
 * любой правке шапки — и молча оставляла мёртвую полосу внизу.
 */
export function renderCard(body: CardBody, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const cardH = body(ctx, false) - CARD.CARD_Y;
  const height = CARD.CARD_Y + cardH + 46;

  canvas.width = CARD.W * SHARE_SCALE;
  canvas.height = height * SHARE_SCALE;
  canvas.style.width = `${CARD.W}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(SHARE_SCALE, SHARE_SCALE);

  ctx.fillStyle = SHARE_COLORS.ground;
  ctx.fillRect(0, 0, CARD.W, height);
  ctx.strokeStyle = SHARE_COLORS.rule;
  ctx.lineWidth = 1;
  for (let y = 12.5; y < height; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD.W, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(17,22,40,0.14)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = SHARE_COLORS.paper;
  cardPath(ctx, cardH, seed);
  ctx.fill();
  ctx.restore();

  body(ctx, true);

  text(ctx, APP_URL, CARD.W / 2, CARD.CARD_Y + cardH + 29, {
    font: `500 11px ${MONO}`,
    color: '#8B93A3',
    align: 'center',
  });

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Имя файла из произвольного заголовка: латиница/кириллица/цифры, остальное — дефис. */
export function buildShareFilename(title: string, isoDate: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `ouro-${slug || fallback}-${isoDate}.png`;
}
```

- [ ] **Step 5: Запустить тест — должен пройти**

Run: `cd frontend && bun run test -- shareCard`
Expected: PASS, 6 тестов.

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/shared/lib/share/
git commit -m "feat(share): оболочка карточки — лист на подложке, рендер в два прохода"
```

---

### Task 3: Карточка долгов

**Files:**
- Modify: `frontend/src/features/share-debts/model/renderDebtsCard.ts` (переписать)
- Modify: `frontend/src/features/share-debts/model/useDebtsShare.ts` (дождаться шрифтов)
- Test: `frontend/src/features/share-debts/model/renderDebtsCard.spec.ts`

**Interfaces:**
- Consumes: `CARD`, `SHARE_COLORS`, `DISPLAY`, `MONO`, `text`, `measure`, `rail`, `drawTear`, `eyebrow`, `hero`, `renderCard`, `type CardBody` из `@/shared/lib/share/shareCard`; `ensureShareFonts` из `@/shared/lib/share/shareFonts`
- Produces:
  - `renderDebtsCardToCanvas(payload: SharedDebtsPayload): HTMLCanvasElement` — имя сохраняется, вызывающий код не меняется
  - `buildReconciliation(payload: SharedDebtsPayload): { mutual: boolean; given: string; taken: string; caption: string }` — экспортируется ради теста
  - `usesMixedCurrency(payload: SharedDebtsPayload): boolean`

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/features/share-debts/model/renderDebtsCard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildReconciliation, usesMixedCurrency } from './renderDebtsCard';
import type { SharedDebtsPayload, SharedDebtEntry } from '@/entities/debt';

function debt(over: Partial<SharedDebtEntry> = {}): SharedDebtEntry {
  return {
    title: 'Долг',
    direction: 'given',
    currency: 'UZS',
    totalAmount: 1000,
    remainingAmount: 1000,
    paidAmount: 0,
    forgivenAmount: 0,
    dueDate: null,
    createdAt: '2026-08-01',
    ...over,
  };
}

function payload(over: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Азамат',
    currency: 'UZS',
    net: 1000,
    totalGiven: 1000,
    totalTaken: 0,
    ownerName: null,
    snapshotAt: Date.parse('2026-08-31'),
    debts: [debt()],
    ...over,
  };
}

describe('buildReconciliation', () => {
  // Нетто — разность встречных сторон, и по списку её не проверить:
  // 1 350 000 + 750 000 + 850 000 никак не даёт 1 250 000.
  it('при встречных долгах показывает обе стороны', () => {
    const r = buildReconciliation(payload({ totalGiven: 2100000, totalTaken: 850000 }));
    expect(r.mutual).toBe(true);
    expect(r.given).toBe('вам должны 2 100 000');
    expect(r.taken).toBe('вы должны 850 000');
  });

  it('при одностороннем долге в вашу пользу — прежняя формулировка', () => {
    const r = buildReconciliation(payload({ net: 1000, totalGiven: 1000, totalTaken: 0 }));
    expect(r.mutual).toBe(false);
    expect(r.caption).toBe('должен вам');
  });

  it('при одностороннем долге с вас — прежняя формулировка', () => {
    const r = buildReconciliation(payload({ net: -1000, totalGiven: 0, totalTaken: 1000 }));
    expect(r.mutual).toBe(false);
    expect(r.caption).toBe('вы должны');
  });
});

describe('usesMixedCurrency', () => {
  it('однородные валюты — голые числа в строках', () => {
    expect(usesMixedCurrency(payload())).toBe(false);
  });

  it('чужая валюта хотя бы в одном долге — валюта в каждой строке', () => {
    expect(
      usesMixedCurrency(payload({ debts: [debt(), debt({ currency: 'USD' })] })),
    ).toBe(true);
  });
});

describe('renderDebtsCardToCanvas', () => {
  it('высота растёт с числом долгов', async () => {
    const { renderDebtsCardToCanvas } = await import('./renderDebtsCard');
    const one = renderDebtsCardToCanvas(payload({ debts: [debt()] })).height;
    const three = renderDebtsCardToCanvas(
      payload({ debts: [debt(), debt(), debt()] }),
    ).height;
    expect(three).toBeGreaterThan(one);
  });

  it('пустой список не роняет рендер', async () => {
    const { renderDebtsCardToCanvas } = await import('./renderDebtsCard');
    expect(renderDebtsCardToCanvas(payload({ debts: [] })).height).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd frontend && bun run test -- renderDebtsCard`
Expected: FAIL, `buildReconciliation` не экспортируется.

- [ ] **Step 3: Переписать `renderDebtsCard.ts`**

Заменить содержимое целиком:

```ts
import { formatLocalDate } from '@/shared/lib/format/date';
import {
  CARD,
  DISPLAY,
  MONO,
  SHARE_COLORS,
  eyebrow,
  drawTear,
  hero,
  measure,
  rail,
  renderCard,
  text,
  type CardBody,
} from '@/shared/lib/share/shareCard';
import type { SharedDebtsPayload } from '@/entities/debt';

const ROW_SUB = 20;
const ROW_GAP = 30;

/** Группировка по три без символа валюты — валюта названа один раз, в шапке. */
function bare(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function shortDate(value: string | number): string {
  return formatLocalDate(typeof value === 'string' ? Date.parse(value) : value);
}

/** Если хоть один долг в чужой валюте — валюта пишется в каждой строке. */
export function usesMixedCurrency(payload: SharedDebtsPayload): boolean {
  return payload.debts.some((d) => d.currency !== payload.currency);
}

/**
 * Строка под суммой. При встречных долгах нетто — разность двух сторон, и по
 * списку её не проверить, поэтому показываем обе стороны. Она же объясняет
 * цвета рельсов ниже, так что отдельная легенда не нужна.
 */
export function buildReconciliation(payload: SharedDebtsPayload): {
  mutual: boolean;
  given: string;
  taken: string;
  caption: string;
} {
  const mutual = payload.totalGiven > 0 && payload.totalTaken > 0;
  return {
    mutual,
    given: `вам должны ${bare(payload.totalGiven)}`,
    taken: `вы должны ${bare(payload.totalTaken)}`,
    caption: payload.net >= 0 ? 'должен вам' : 'вы должны',
  };
}

function debtsBody(payload: SharedDebtsPayload): CardBody {
  const { CX, CR, CW, GUTTER } = CARD;
  const mixed = usesMixedCurrency(payload);
  const positive = payload.net >= 0;
  const heroColor = positive ? SHARE_COLORS.givenText : SHARE_COLORS.takenText;

  return (ctx, draw) => {
    let y = eyebrow(ctx, draw, shortDate(payload.snapshotAt));

    y += 24;
    if (draw) {
      text(ctx, payload.personName, CX, y, {
        font: `600 15px ${DISPLAY}`,
        color: SHARE_COLORS.ink,
        max: CW,
      });
    }

    y += 44;
    hero(ctx, draw, y, `${positive ? '+' : '−'}${bare(Math.abs(payload.net))}`, payload.currency, heroColor);

    y += 25;
    if (draw) {
      const r = buildReconciliation(payload);
      if (r.mutual) {
        const font = `500 13px ${DISPLAY}`;
        const sep = '  ·  ';
        text(ctx, r.given, CX, y, { font, color: SHARE_COLORS.givenText });
        const afterGiven = CX + measure(ctx, r.given, font);
        text(ctx, sep, afterGiven, y, { font, color: SHARE_COLORS.inkFaint });
        text(ctx, r.taken, afterGiven + measure(ctx, sep, font), y, {
          font,
          color: SHARE_COLORS.takenText,
        });
      } else {
        text(ctx, r.caption, CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkSoft,
        });
      }
    }

    // Отрыв делит корешок и список — он же и есть разделитель секций
    y += 26;
    if (draw) drawTear(ctx, y);
    y += 28;

    if (payload.debts.length === 0) {
      if (draw) {
        text(ctx, 'Открытых долгов нет', CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
        });
      }
      return y + 24;
    }

    payload.debts.forEach((debt, index) => {
      if (draw) {
        rail(
          ctx,
          CX,
          y - 13,
          ROW_SUB + 17,
          debt.direction === 'given' ? SHARE_COLORS.givenRail : SHARE_COLORS.takenRail,
        );

        const amount = mixed
          ? `${bare(debt.remainingAmount)} ${debt.currency}`
          : bare(debt.remainingAmount);
        const amountFont = `600 15px ${MONO}`;
        const amountWidth = measure(ctx, amount, amountFont);

        text(ctx, debt.title, CX + GUTTER, y, {
          font: `500 15px ${DISPLAY}`,
          color: SHARE_COLORS.ink,
          max: CW - GUTTER - amountWidth - 16,
        });
        text(ctx, amount, CR, y, {
          font: amountFont,
          color: SHARE_COLORS.ink,
          align: 'right',
        });

        // Прощённое называем отдельно: иначе «отдано 20 000 из 50 000» рядом с
        // остатком 20 000 не сходится у тех, кто по карточке сверяется.
        const parts: string[] = [];
        if (debt.paidAmount > 0) {
          parts.push(`отдано ${bare(debt.paidAmount)} из ${bare(debt.totalAmount)}`);
        }
        if (debt.forgivenAmount > 0) parts.push(`прощено ${bare(debt.forgivenAmount)}`);
        if (debt.dueDate) parts.push(`до ${shortDate(debt.dueDate)}`);

        text(ctx, parts.join('  ·  ') || 'без срока', CX + GUTTER, y + ROW_SUB, {
          font: `500 12px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
          max: CW - GUTTER,
        });
      }
      y += ROW_SUB + (index < payload.debts.length - 1 ? ROW_GAP : 0);
    });

    return y + 26;
  };
}

/**
 * Карточка сверки по долгам одного человека — то, что отправляют картинкой
 * вместо скриншота. Форму рваного края сеет дата снимка, поэтому один и тот же
 * снимок всегда даёт одну и ту же картинку.
 */
export function renderDebtsCardToCanvas(payload: SharedDebtsPayload): HTMLCanvasElement {
  return renderCard(debtsBody(payload), payload.snapshotAt);
}
```

- [ ] **Step 4: Дождаться шрифтов в `useDebtsShare.ts`**

В `frontend/src/features/share-debts/model/useDebtsShare.ts` добавить импорт:

```ts
import { ensureShareFonts } from '@/shared/lib/share/shareFonts';
```

и перед каждым вызовом `renderDebtsCardToCanvas(...)` поставить `await ensureShareFonts();`.

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `cd frontend && bun run test -- renderDebtsCard`
Expected: PASS, 7 тестов.

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/features/share-debts/
git commit -m "feat(share): карточка долгов — новый макет и строка сверки встречных сумм"
```

---

### Task 4: Карточка чека

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useReceiptShare.ts`
- Create: `frontend/src/features/scan-receipt/model/renderReceiptCard.ts`
- Test: `frontend/src/features/scan-receipt/model/renderReceiptCard.spec.ts`

**Interfaces:**
- Consumes: те же примитивы из `@/shared/lib/share/shareCard`; `ReceiptShareData` из `./useReceiptShare`
- Produces:
  - `renderReceiptCardToCanvas(data: ReceiptShareData): HTMLCanvasElement`
  - `buildChargesNote(charges: ReceiptCharge[], chargesAmount: number): string | null`
  - `type ReceiptShareData` переезжает в `renderReceiptCard.ts` и реэкспортируется из `useReceiptShare.ts`

Рендер выносится из композабла в отдельный файл: `useReceiptShare.ts` на 435 строк делает и рисование, и три способа поделиться.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/features/scan-receipt/model/renderReceiptCard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildChargesNote, renderReceiptCardToCanvas } from './renderReceiptCard';
import type { ReceiptShareData } from './renderReceiptCard';
import type { ParticipantSummary } from './types';

function participant(over: Partial<ParticipantSummary> = {}): ParticipantSummary {
  return {
    id: 'p',
    name: 'Азамат',
    isMe: false,
    color: '#F59E0B',
    itemCount: 1,
    total: 100,
    items: [{ id: 'i', name: 'Плов', lineTotal: 100, share: 100, sharedWith: 1 }],
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
    const one = renderReceiptCardToCanvas(data()).height;
    const many = renderReceiptCardToCanvas(
      data({
        participants: [
          participant({ id: 'me', name: 'Вы', isMe: true }),
          participant({
            items: [
              { id: 'a', name: 'Плов', lineTotal: 100, share: 100, sharedWith: 1 },
              { id: 'b', name: 'Лагман', lineTotal: 100, share: 100, sharedWith: 1 },
              { id: 'c', name: 'Ачик-чучук', lineTotal: 100, share: 50, sharedWith: 2 },
            ],
          }),
        ],
      }),
    ).height;
    expect(many).toBeGreaterThan(one);
  });

  it('когда должников нет, карточка всё равно рисуется', () => {
    const canvas = renderReceiptCardToCanvas(
      data({ participants: [participant({ id: 'me', name: 'Вы', isMe: true })] }),
    );
    expect(canvas.height).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd frontend && bun run test -- renderReceiptCard`
Expected: FAIL, модуля `./renderReceiptCard` нет.

- [ ] **Step 3: Создать `renderReceiptCard.ts`**

```ts
import { formatLocalDate } from '@/shared/lib/format/date';
import {
  CARD,
  DISPLAY,
  MONO,
  SHARE_COLORS,
  drawTear,
  eyebrow,
  hero,
  measure,
  rail,
  renderCard,
  text,
  type CardBody,
} from '@/shared/lib/share/shareCard';
import type { ParticipantSummary, ReceiptCharge } from './types';

export interface ReceiptShareData {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  participants: ParticipantSummary[];
}

const NAME_ROW = 24;
const ITEM_ROW = 19;
const PARTICIPANT_GAP = 18;
const LABEL_GAP = 26;

function bare(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Доля общей позиции подписывается прямо в названии: «Ачик-чучук · 1/2». */
function itemLabel(item: { name: string; sharedWith: number }): string {
  return item.sharedWith > 1 ? `${item.name} · 1/${item.sharedWith}` : item.name;
}

export function buildChargesNote(
  charges: ReceiptCharge[],
  chargesAmount: number,
): string | null {
  const enabled = charges.filter((c) => c.enabled);
  if (enabled.length === 0 || chargesAmount <= 0) return null;

  const labels = enabled
    .map((c) =>
      c.type === 'amount'
        ? `${bare(c.amount)} ${c.label.toLowerCase()}`
        : `${c.percent}% ${c.label.toLowerCase()}`,
    )
    .join(', ');
  return `Суммы включают ${labels}`;
}

function receiptBody(data: ReceiptShareData): CardBody {
  const { CX, CR, CW, GUTTER } = CARD;
  const owers = data.participants.filter((p) => !p.isMe && p.total > 0);
  const back = owers.reduce((sum, p) => sum + p.total, 0);
  const note = buildChargesNote(data.charges, data.chargesAmount);

  return (ctx, draw) => {
    let y = eyebrow(ctx, draw, formatLocalDate(data.date));

    y += 24;
    if (draw) {
      text(ctx, data.storeName || 'Чек', CX, y, {
        font: `600 15px ${DISPLAY}`,
        color: SHARE_COLORS.ink,
        max: CW,
      });
    }

    y += 44;
    hero(ctx, draw, y, bare(data.totalAmount), data.currency, SHARE_COLORS.ink);

    y += 25;
    if (draw) {
      text(
        ctx,
        back > 0 ? `вам вернут ${bare(back)} ${data.currency}` : 'делить не с кем',
        CX,
        y,
        { font: `500 14px ${DISPLAY}`, color: SHARE_COLORS.inkSoft },
      );
    }

    y += 26;
    if (draw) drawTear(ctx, y);
    y += 30;

    if (owers.length === 0) {
      if (draw) {
        text(ctx, 'Никто ничего не должен', CX, y, {
          font: `500 14px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
        });
      }
      return y + 24;
    }

    // Заголовок нужен: без него список читается как «кто сколько съел»,
    // а это суммы к возврату, и своей строки у плательщика в нём нет
    if (draw) {
      text(ctx, 'КТО СКОЛЬКО ДОЛЖЕН', CX, y, {
        font: `600 11px ${DISPLAY}`,
        color: SHARE_COLORS.inkFaint,
        track: 1.4,
      });
    }
    y += LABEL_GAP;

    owers.forEach((p, index) => {
      if (draw) {
        rail(ctx, CX, y - 14, NAME_ROW + (p.items.length - 1) * ITEM_ROW + 18, p.color);

        const amount = bare(p.total);
        const amountFont = `600 16px ${MONO}`;
        const amountWidth = measure(ctx, amount, amountFont);
        text(ctx, p.name, CX + GUTTER, y, {
          font: `600 16px ${DISPLAY}`,
          color: SHARE_COLORS.ink,
          max: CW - GUTTER - amountWidth - 16,
        });
        text(ctx, amount, CR, y, {
          font: amountFont,
          color: SHARE_COLORS.ink,
          align: 'right',
        });

        p.items.forEach((item, j) => {
          const iy = y + NAME_ROW + j * ITEM_ROW;
          const itemFont = `500 12px ${MONO}`;
          const itemWidth = measure(ctx, bare(item.share), itemFont);
          text(ctx, itemLabel(item), CX + GUTTER, iy, {
            font: `500 13px ${DISPLAY}`,
            color: SHARE_COLORS.inkSoft,
            max: CW - GUTTER - itemWidth - 16,
          });
          text(ctx, bare(item.share), CR, iy, {
            font: itemFont,
            color: SHARE_COLORS.inkFaint,
            align: 'right',
          });
        });
      }
      y += NAME_ROW + p.items.length * ITEM_ROW + (index < owers.length - 1 ? PARTICIPANT_GAP : 0);
    });

    if (note) {
      y += 22;
      if (draw) {
        // Волосяная линия — иначе примечание читается как ещё одна позиция
        ctx.beginPath();
        ctx.strokeStyle = SHARE_COLORS.hairline;
        ctx.lineWidth = 1;
        ctx.moveTo(CX, y - 13.5);
        ctx.lineTo(CR, y - 13.5);
        ctx.stroke();
        text(ctx, note, CX, y, {
          font: `500 12px ${DISPLAY}`,
          color: SHARE_COLORS.inkFaint,
          max: CW,
        });
      }
      y += 4;
    }

    return y + 26;
  };
}

export function renderReceiptCardToCanvas(data: ReceiptShareData): HTMLCanvasElement {
  return renderCard(receiptBody(data), data.date);
}
```

- [ ] **Step 4: Почистить `useReceiptShare.ts`**

Удалить из `frontend/src/features/scan-receipt/model/useReceiptShare.ts` весь блок констант вёрстки (`FONT_FAMILY`…`LOGO_SIZE`), функции `drawDivider`, `drawHeader`, `calcParticipantsHeight`, `drawParticipants`, `renderCardToCanvas`, `formatItemName` и интерфейс `ReceiptShareData`. Оставить `buildShareText`, `buildFilename` и сам композабл.

Импорты в шапке заменить на:

```ts
import { ref } from 'vue';
import { useToast } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { formatCurrency } from '@/shared/lib/format/currency';
import { toLocalISODate } from '@/shared/lib/date';
import {
  APP_URL,
  buildShareFilename,
  canvasToBlob,
  downloadBlob,
} from '@/shared/lib/share/shareCard';
import { ensureShareFonts } from '@/shared/lib/share/shareFonts';
import { renderReceiptCardToCanvas, type ReceiptShareData } from './renderReceiptCard';

export type { ReceiptShareData };
```

В `buildShareText` вернуть локальный хелпер долей, он больше не общий с рендером:

```ts
function formatItemName(item: { name: string; sharedWith: number }): string {
  return item.sharedWith > 1 ? `${item.name} (1/${item.sharedWith})` : item.name;
}
```

В `shareAsImage` и `saveToGallery` заменить `renderCardToCanvas(data)` на:

```ts
      await ensureShareFonts();
      const canvas = renderReceiptCardToCanvas(data);
```

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `cd frontend && bun run test -- renderReceiptCard`
Expected: PASS, 6 тестов.

- [ ] **Step 6: Проверить, что ничего не отвалилось**

Run: `cd frontend && bun run test && bun run build`
Expected: все тесты зелёные, сборка без ошибок типов.

- [ ] **Step 7: Коммит**

```bash
git add frontend/src/features/scan-receipt/
git commit -m "feat(share): карточка чека — новый макет, рендер вынесен из композабла"
```

---

### Task 5: Примитивы SVG на бэкенде

**Files:**
- Create: `backend/src/shared/utils/share-card.svg.ts`
- Test: `backend/src/shared/utils/share-card.svg.spec.ts`

**Interfaces:**
- Produces:
  - `SHARE_FONT_FILES: string[]` — пять абсолютных путей к ttf
  - `SHARE_DISPLAY = 'Golos Text'`, `SHARE_MONO = 'IBM Plex Mono'`
  - `OG: { W: 1200; H: 630; X: 76; CW: 616; PAD: 40; CX: number; CR: number; RIGHT: 772; ROW_H: 60 }`
  - `SVG_COLORS` — те же токены, что во фронтовом `SHARE_COLORS`
  - `plural(n: number, one: string, few: string, many: string): string`
  - `ogCardHeight(rowCount: number, hasExtra: boolean): number`
  - `ogLayout(cardH: number): { y: number; tearY: number; row0: number }`
  - `ogChrome(dateLabel: string, seed: number, cardH: number, y: number): string`
  - `ogTear(y: number, tearY: number): string`
  - `ogHero(o: { y: number; subject: string; amount: string; currency: string; color: string; caption: string }): string`
  - `ogRows(rows: OgRow[], row0: number): string` где `interface OgRow { color: string; title: string; sub: string; amount: string; unit: [one: string, few: string, many: string] }`
  - `ogPoster(line1: string, line2: string, sub: string, cta: string): string`

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/shared/utils/share-card.svg.spec.ts`:

```ts
import { ogCardHeight, ogLayout, ogRows, ogHero, plural, OG } from './share-card.svg';

describe('plural', () => {
  it('склоняет по-русски', () => {
    expect(plural(1, 'позиция', 'позиции', 'позиций')).toBe('позиция');
    expect(plural(2, 'позиция', 'позиции', 'позиций')).toBe('позиции');
    expect(plural(5, 'позиция', 'позиции', 'позиций')).toBe('позиций');
    expect(plural(11, 'позиция', 'позиции', 'позиций')).toBe('позиций');
    expect(plural(21, 'позиция', 'позиции', 'позиций')).toBe('позиция');
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
});

describe('ogLayout', () => {
  it('центрирует бумагу по холсту', () => {
    const { y } = ogLayout(400);
    expect(y).toBe((OG.H - 400) / 2);
  });
});

describe('ogRows', () => {
  const row = (title: string) => ({
    color: '#F59E0B',
    title,
    sub: 'без срока',
    amount: '1 000',
    unit: ['долг', 'долга', 'долгов'] as [string, string, string],
  });

  it('режет длинное название — в SVG измерить текст нечем', () => {
    const svg = ogRows([row('Первый взнос за квартиру в Юнусабаде')], 300);
    expect(svg).toContain('…');
    expect(svg).not.toContain('Юнусабаде<');
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
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd backend && bun run test -- share-card.svg`
Expected: FAIL, модуля нет.

- [ ] **Step 3: Написать `share-card.svg.ts`**

```ts
import { join } from 'path';
import { escapeXml, truncate } from './share';

/**
 * Примитивы OG-карточки 1200×630: слева — бумажный лист (тот же язык, что у
 * canvas-карточек в приложении), справа — постер со ссылкой. Оба модуля,
 * долги и чек, собирают свою картинку из этих кусков.
 */

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');

export const SHARE_FONT_FILES = [
  join(FONT_DIR, 'golos-500.ttf'),
  join(FONT_DIR, 'golos-600.ttf'),
  join(FONT_DIR, 'golos-800.ttf'),
  join(FONT_DIR, 'plex-mono-500.ttf'),
  join(FONT_DIR, 'plex-mono-600.ttf'),
];

export const SHARE_DISPLAY = 'Golos Text';
export const SHARE_MONO = 'IBM Plex Mono';

export const OG = {
  W: 1200,
  H: 630,
  X: 76,
  CW: 616,
  PAD: 40,
  CX: 76 + 40,
  CR: 76 + 616 - 40,
  RIGHT: 772,
  ROW_H: 60,
} as const;

export const SVG_COLORS = {
  ground: '#E6E9F0',
  paper: '#FFFFFF',
  ink: '#141418',
  inkSoft: '#565B6B',
  inkFaint: '#98A0B0',
  hairline: '#E2E6EC',
  perf: '#C6CDD9',
  goldText: '#96691C',
  gold1: '#C59B3F',
  gold2: '#E8C865',
  givenText: '#C2620A',
  givenRail: '#F59E0B',
  takenText: '#7E22CE',
  takenRail: '#A855F7',
  urlGray: '#8B93A3',
} as const;

const TEAR_TO_LINE = 286;
const LINE_TO_ROW0 = 56;
const EXTRA_ROW = 34;

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Рваный верхний край листа: зубцы неравной глубины, форма сеется датой снимка. */
function tornPath(x: number, y: number, w: number, h: number, seed: number): string {
  const rng = mulberry32(seed);
  const r = 24;
  const amp = 9;
  let d = `M${x} ${(y + amp * 0.5).toFixed(1)}`;
  let px = x;
  while (px < x + w) {
    px = Math.min(px + 6 + rng() * 8, x + w);
    d += ` L${px.toFixed(1)} ${(y + rng() * amp * (rng() < 0.18 ? 1.7 : 1)).toFixed(1)}`;
  }
  d += ` L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h}`;
  d += ` L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} Z`;
  return d;
}

/** Высота бумаги — от числа строк: пустой низ выглядел бы обрывом вёрстки. */
export function ogCardHeight(rowCount: number, hasExtra: boolean): number {
  const shown = Math.min(rowCount, 3);
  return (
    TEAR_TO_LINE + LINE_TO_ROW0 + (shown - 1) * OG.ROW_H + 22 + 32 + (hasExtra ? EXTRA_ROW : 0)
  );
}

export function ogLayout(cardH: number): { y: number; tearY: number; row0: number } {
  const y = (OG.H - cardH) / 2;
  const tearY = y + TEAR_TO_LINE;
  return { y, tearY, row0: tearY + LINE_TO_ROW0 };
}

export function ogChrome(dateLabel: string, seed: number, cardH: number, y: number): string {
  let rules = '';
  for (let ry = 16.5; ry < OG.H; ry += 30) {
    rules += `<line x1="0" y1="${ry}" x2="${OG.W}" y2="${ry}" stroke="#141828" stroke-opacity="0.05" stroke-width="1"/>`;
  }
  return `<defs>
    <linearGradient id="au" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${SVG_COLORS.gold1}"/><stop offset="0.5" stop-color="${SVG_COLORS.gold2}"/><stop offset="1" stop-color="${SVG_COLORS.gold1}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="13" stdDeviation="16" flood-color="#111628" flood-opacity="0.17"/>
    </filter>
  </defs>
  <rect width="${OG.W}" height="${OG.H}" fill="${SVG_COLORS.ground}"/>${rules}
  <path d="${tornPath(OG.X, y, OG.CW, cardH, seed)}" fill="${SVG_COLORS.paper}" filter="url(#sh)"/>
  <circle cx="${OG.CX + 15}" cy="${y + 48}" r="15" fill="${SVG_COLORS.ink}"/>
  <circle cx="${OG.CX + 15}" cy="${y + 48}" r="8.3" fill="none" stroke="url(#au)" stroke-width="5.1"/>
  <text x="${OG.CX + 44}" y="${y + 55}" font-family="${SHARE_DISPLAY}" font-size="18" font-weight="600" letter-spacing="2.6" fill="${SVG_COLORS.goldText}">OURO FINANCE</text>
  <text x="${OG.CR}" y="${y + 55}" text-anchor="end" font-family="${SHARE_MONO}" font-size="18" font-weight="500" fill="${SVG_COLORS.inkFaint}">${escapeXml(dateLabel)}</text>
  <line x1="${OG.CX}" y1="${y + 78}" x2="${OG.CR}" y2="${y + 78}" stroke="${SVG_COLORS.hairline}" stroke-width="2"/>`;
}

export function ogTear(tearY: number): string {
  return `<circle cx="${OG.X}" cy="${tearY}" r="17" fill="${SVG_COLORS.ground}"/>
  <circle cx="${OG.X + OG.CW}" cy="${tearY}" r="17" fill="${SVG_COLORS.ground}"/>
  <line x1="${OG.X + 29}" y1="${tearY}" x2="${OG.X + OG.CW - 29}" y2="${tearY}" stroke="${SVG_COLORS.perf}" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round"/>`;
}

/** Валюта — tspan в том же text: ширину суммы посчитает рендерер, а не мы. */
export function ogHero(o: {
  y: number;
  subject: string;
  amount: string;
  currency: string;
  color: string;
  caption: string;
}): string {
  return `<text x="${OG.CX}" y="${o.y + 124}" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="600" fill="${SVG_COLORS.ink}">${escapeXml(truncate(o.subject, 26))}</text>
  <text x="${OG.CX}" y="${o.y + 194}" font-family="${SHARE_DISPLAY}" font-size="58" font-weight="800" letter-spacing="-1" fill="${o.color}">${escapeXml(o.amount)}<tspan dx="14" font-size="26" font-weight="600" letter-spacing="0" fill="${SVG_COLORS.inkSoft}">${escapeXml(o.currency)}</tspan></text>
  <text x="${OG.CX}" y="${o.y + 234}" font-family="${SHARE_DISPLAY}" font-size="22" font-weight="500" fill="${SVG_COLORS.inkSoft}">${escapeXml(o.caption)}</text>`;
}

export interface OgRow {
  color: string;
  title: string;
  sub: string;
  amount: string;
  unit: [one: string, few: string, many: string];
}

export function ogRows(rows: OgRow[], row0: number): string {
  const visible = rows.slice(0, 3);
  let out = '';
  visible.forEach((row, i) => {
    const y = row0 + i * OG.ROW_H;
    // Мерить текст в SVG нечем — режем по знакам, с оглядкой на длину суммы
    const title = truncate(row.title, row.amount.length > 9 ? 18 : 22);
    out += `<rect x="${OG.CX}" y="${y - 21}" width="5" height="46" rx="2.5" fill="${row.color}"/>
    <text x="${OG.CX + 26}" y="${y}" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="500" fill="${SVG_COLORS.ink}">${escapeXml(title)}</text>
    <text x="${OG.CX + 26}" y="${y + 22}" font-family="${SHARE_DISPLAY}" font-size="17" font-weight="500" fill="${SVG_COLORS.inkFaint}">${escapeXml(row.sub)}</text>
    <text x="${OG.CR}" y="${y}" text-anchor="end" font-family="${SHARE_MONO}" font-size="24" font-weight="600" fill="${SVG_COLORS.ink}">${escapeXml(row.amount)}</text>`;
  });

  const extra = rows.length - visible.length;
  if (extra > 0 && rows[0]) {
    const [one, few, many] = rows[0].unit;
    out += `<text x="${OG.CX + 26}" y="${row0 + visible.length * OG.ROW_H + 4}" font-family="${SHARE_DISPLAY}" font-size="20" font-weight="500" fill="${SVG_COLORS.inkFaint}">и ещё ${extra} ${plural(extra, one, few, many)}</text>`;
  }
  return out;
}

/** Постер выровнен по холсту, а не по бумаге: её высота гуляет от числа строк. */
export function ogPoster(line1: string, line2: string, sub: string, cta: string): string {
  const { RIGHT } = OG;
  return `<text x="${RIGHT}" y="212" font-family="${SHARE_DISPLAY}" font-size="60" font-weight="800" fill="${SVG_COLORS.ink}" letter-spacing="-1.2">${escapeXml(line1)}</text>
  <text x="${RIGHT}" y="280" font-family="${SHARE_DISPLAY}" font-size="60" font-weight="800" fill="${SVG_COLORS.ink}" letter-spacing="-1.2">${escapeXml(line2)}</text>
  <text x="${RIGHT}" y="336" font-family="${SHARE_DISPLAY}" font-size="23" font-weight="500" fill="${SVG_COLORS.inkSoft}">${escapeXml(sub)}</text>
  <rect x="${RIGHT}" y="378" width="296" height="70" rx="35" fill="${SVG_COLORS.ink}"/>
  <text x="${RIGHT + 148}" y="422" text-anchor="middle" font-family="${SHARE_DISPLAY}" font-size="24" font-weight="800" fill="#ffffff">${escapeXml(cta)}</text>
  <text x="${RIGHT}" y="500" font-family="${SHARE_MONO}" font-size="18" font-weight="500" fill="${SVG_COLORS.urlGray}">app.ouro-finance.top</text>`;
}

/** Целые с группировкой по три и без символа валюты — как в карточках приложения. */
export function bareAmount(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `cd backend && bun run test -- share-card.svg share-fonts`
Expected: PASS, включая тесты шрифтов из Task 1.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/shared/utils/share-card.svg.ts backend/src/shared/utils/share-card.svg.spec.ts
git commit -m "feat(share): общие примитивы OG-карточки для долгов и чека"
```

---

### Task 6: OG-превью долгов

**Files:**
- Modify: `backend/src/modules/debt/application/services/debts-og-image.service.ts`
- Test: `backend/src/modules/debt/application/services/debts-og-image.service.spec.ts`

**Interfaces:**
- Consumes: всё из `share-card.svg.ts`; `SharedDebtsPayload` из `./shared-debts.service`
- Produces: `buildDebtsOgSvg(payload: SharedDebtsPayload): string` — имя сохраняется

- [ ] **Step 1: Написать падающий тест**

Создать `backend/src/modules/debt/application/services/debts-og-image.service.spec.ts`:

```ts
import { Resvg } from '@resvg/resvg-js';
import { buildDebtsOgSvg } from './debts-og-image.service';
import { SHARE_FONT_FILES, SHARE_DISPLAY } from '../../../../shared/utils/share-card.svg';
import type { SharedDebtsPayload, SharedDebtEntry } from './shared-debts.service';

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
  } as SharedDebtEntry;
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
  } as SharedDebtsPayload;
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
    const pathY = (svg: string) => Number(/M76 ([\d.]+)/.exec(svg)![1]);
    expect(pathY(three)).toBeLessThan(pathY(one));
  });

  it('один снимок всегда даёт один и тот же SVG', () => {
    expect(buildDebtsOgSvg(payload())).toBe(buildDebtsOgSvg(payload()));
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
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `cd backend && bun run test -- debts-og-image`
Expected: FAIL — старый SVG не содержит «вам должны».

- [ ] **Step 3: Переписать сервис**

Заменить содержимое `backend/src/modules/debt/application/services/debts-og-image.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { SharedDebtsService, type SharedDebtsPayload } from './shared-debts.service';
import {
  OG,
  SHARE_DISPLAY,
  SHARE_FONT_FILES,
  SVG_COLORS,
  bareAmount,
  ogCardHeight,
  ogChrome,
  ogHero,
  ogLayout,
  ogPoster,
  ogRows,
  ogTear,
  type OgRow,
} from '../../../../shared/utils/share-card.svg';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Кэш живёт в памяти процесса, а токены раздаются наружу: без потолка
// краулер, обошедший тысячу ссылок, оставил бы в куче тысячу PNG.
const CACHE_MAX_ENTRIES = 200;

const DEBT_UNIT: [string, string, string] = ['долг', 'долга', 'долгов'];

function shortDate(value: string | number): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear()).slice(2)}`;
}

/**
 * 1200×630: слева бумажный лист сверки, справа постер со ссылкой. Pure function,
 * без I/O; все строки экранируются в примитивах.
 */
export function buildDebtsOgSvg(payload: SharedDebtsPayload): string {
  const positive = payload.net >= 0;
  const mutual = payload.totalGiven > 0 && payload.totalTaken > 0;
  const mixed = payload.debts.some((d) => d.currency !== payload.currency);

  const cardH = ogCardHeight(payload.debts.length, payload.debts.length > 3);
  const { y, tearY, row0 } = ogLayout(cardH);

  const rows: OgRow[] = payload.debts.map((d) => ({
    color: d.direction === 'given' ? SVG_COLORS.givenRail : SVG_COLORS.takenRail,
    title: d.title,
    sub: d.dueDate ? `до ${shortDate(d.dueDate)}` : 'без срока',
    amount: mixed
      ? `${bareAmount(d.remainingAmount)} ${d.currency}`
      : bareAmount(d.remainingAmount),
    unit: DEBT_UNIT,
  }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.W}" height="${OG.H}" viewBox="0 0 ${OG.W} ${OG.H}">
  ${ogChrome(shortDate(payload.snapshotAt), payload.snapshotAt, cardH, y)}
  ${ogHero({
    y,
    subject: payload.personName,
    amount: `${positive ? '+' : '−'}${bareAmount(Math.abs(payload.net))}`,
    currency: payload.currency,
    color: positive ? SVG_COLORS.givenText : SVG_COLORS.takenText,
    caption: mutual
      ? `вам должны ${bareAmount(payload.totalGiven)}  ·  вы должны ${bareAmount(payload.totalTaken)}`
      : positive
        ? 'должен вам'
        : 'вы должны',
  })}
  ${ogTear(tearY)}
  ${ogRows(rows, row0)}
  ${ogPoster('Сверка', 'по долгам', 'Все суммы — по ссылке', 'Открыть сверку')}
</svg>`;
}

interface CacheEntry {
  buf: Buffer;
  at: number;
}

@Injectable()
export class DebtsOgImageService {
  private readonly logger = new Logger(DebtsOgImageService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly sharedDebtsService: SharedDebtsService) {}

  async getOgPng(token: string): Promise<Buffer> {
    const cached = this.cache.get(token);
    if (cached) {
      if (Date.now() - cached.at < CACHE_TTL_MS) return cached.buf;
      this.cache.delete(token);
    }

    const payload = await this.sharedDebtsService.getByToken(token);
    const svg = buildDebtsOgSvg(payload);

    try {
      const buf = new Resvg(svg, {
        font: {
          fontFiles: SHARE_FONT_FILES,
          loadSystemFonts: false,
          defaultFontFamily: SHARE_DISPLAY,
        },
      })
        .render()
        .asPng();

      if (this.cache.size >= CACHE_MAX_ENTRIES) {
        // Map держит порядок вставки — выкидываем самый давний
        const oldest = this.cache.keys().next();
        if (!oldest.done) this.cache.delete(oldest.value);
      }
      this.cache.set(token, { buf, at: Date.now() });
      return buf;
    } catch (error) {
      this.logger.warn(`Failed to render debts OG image for token ${token}: ${String(error)}`);
      throw error;
    }
  }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `cd backend && bun run test -- debts-og-image`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Коммит**

```bash
git add backend/src/modules/debt/application/services/
git commit -m "feat(share): OG-превью долгов на общих примитивах карточки"
```

---

### Task 7: OG-превью чека

**Files:**
- Modify: `backend/src/modules/receipt/application/services/og-image.service.ts`
- Test: `backend/src/modules/receipt/application/services/og-image.service.spec.ts`

**Interfaces:**
- Consumes: всё из `share-card.svg.ts`; `SharedReceiptPayload` из `./shared-receipt.service`
- Produces: `buildOgSvg(payload: SharedReceiptPayload): string` — имя сохраняется

- [ ] **Step 1: Прочитать текущий сервис целиком**

Run: `sed -n 60,145p backend/src/modules/receipt/application/services/og-image.service.ts`

Нужно снять точную форму `SharedReceiptPayload` (поля участника: `name`, `color`, `total`, число позиций) — тест и новый код должны опираться на неё, а не на догадки.

- [ ] **Step 2: Написать падающий тест**

Создать `backend/src/modules/receipt/application/services/og-image.service.spec.ts`. Каркас (поля участника уточнить по шагу 1):

```ts
import { Resvg } from '@resvg/resvg-js';
import { buildOgSvg } from './og-image.service';
import { SHARE_FONT_FILES, SHARE_DISPLAY } from '../../../../shared/utils/share-card.svg';
import type { SharedReceiptPayload } from './shared-receipt.service';

function payload(over: Partial<SharedReceiptPayload> = {}): SharedReceiptPayload {
  return {
    storeName: 'Chorsu Bazaar',
    date: Date.parse('2026-08-29'),
    currency: 'UZS',
    totalAmount: 486000,
    participants: [
      { name: 'Азамат', color: '#F59E0B', total: 198000, itemCount: 3 },
      { name: 'Дилноза', color: '#10B981', total: 132000, itemCount: 2 },
    ],
    ...over,
  } as SharedReceiptPayload;
}

describe('buildOgSvg', () => {
  it('называет сумму к возврату, а не только итог чека', () => {
    expect(buildOgSvg(payload())).toContain('вам вернут 330 000 UZS');
  });

  it('склоняет число позиций', () => {
    const svg = buildOgSvg(payload());
    expect(svg).toContain('3 позиции');
    expect(svg).toContain('2 позиции');
  });

  it('склоняет единственное число', () => {
    const svg = buildOgSvg(
      payload({ participants: [{ name: 'Азамат', color: '#F59E0B', total: 1000, itemCount: 1 }] }),
    );
    expect(svg).toContain('1 позиция');
  });

  it('подставляет запасной цвет вместо мусора в поле цвета', () => {
    const svg = buildOgSvg(
      payload({
        participants: [
          { name: 'Азамат', color: 'javascript:alert(1)', total: 1000, itemCount: 1 },
        ],
      }),
    );
    expect(svg).not.toContain('javascript:');
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
```

- [ ] **Step 3: Запустить тест — должен упасть**

Run: `cd backend && bun run test -- og-image.service`
Expected: FAIL.

- [ ] **Step 4: Переписать сервис**

Тело `buildOgSvg` строится ровно как в Task 6, с заменами: герой — `bareAmount(payload.totalAmount)` цветом `SVG_COLORS.ink`, подпись — `вам вернут ${bareAmount(back)} ${currency}` где `back` — сумма `total` всех участников, кроме плательщика; строки — участники с цветом из `p.color`, прошедшим проверку `/^#[0-9a-fA-F]{3,8}$/` (иначе `SVG_COLORS.givenRail`), подпись строки — `${p.itemCount} ${plural(p.itemCount, 'позиция', 'позиции', 'позиций')}`, `unit: ['человек', 'человека', 'человек']`; постер — `ogPoster('Счёт', 'разделён', 'Кто сколько должен — по ссылке', 'Открыть чек')`. Классу `OgImageService` оставить кэш и `Resvg` в том же виде, что в Task 6, поменяв только источник шрифтов.

- [ ] **Step 5: Запустить тесты — должны пройти**

Run: `cd backend && bun run test -- og-image.service`
Expected: PASS, 5 тестов.

- [ ] **Step 6: Прогнать весь бэкенд**

Run: `cd backend && bun run test && bun run build`
Expected: зелено, сборка без ошибок.

- [ ] **Step 7: Коммит**

```bash
git add backend/src/modules/receipt/application/services/
git commit -m "feat(share): OG-превью чека на общих примитивах карточки"
```

---

### Task 8: Changelog и финальная проверка

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Узнать текущую версию**

Run: `head -30 frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 2: Добавить запись первой в массив**

Патч-версия на единицу больше верхней. Тип `improvement`:

```ts
  {
    version: '<текущая + 1 патч>',
    date: '2026-08-31',
    type: 'improvement',
    title: 'Новые картинки для долгов и чеков',
    description:
      'Картинка, которой вы делитесь в мессенджере, полностью переделана: суммы стали читаемее, а у встречных долгов теперь видно обе стороны — сколько должны вам и сколько вы. Так же выглядят и превью ссылок.',
  },
```

- [ ] **Step 3: Прогнать всё**

Run:
```bash
cd frontend && bun run test && bun run lint && bun run build
cd ../backend && bun run test && bun run lint && bun run build
```
Expected: зелено везде.

- [ ] **Step 4: Проверить, что шрифты не уехали в precache**

Run:
```bash
cd frontend && grep -c "share-fonts" dist/sw.js
ls dist/share-fonts/
```
Expected: `dist/share-fonts/` содержит пять woff2; в precache-манифесте `sw.js` их нет (правило `share-fonts` в runtimeCaching при этом присутствует — искать по имени кэша, а не по путям файлов).

- [ ] **Step 5: Снять контрольный скриншот**

Открыть `.ui-design/share-cards-mockup.html` и сверить с реализацией визуально: рваный край, вырезы, рельсы, строка сверки, моноширинные суммы.

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): новые картинки шаринга"
```

---

## Self-review

**Покрытие спеки.** Токены и типографика — Task 1–2. Рваный край, вырезы, подложка, один бренд-блок, рельсы — Task 2. Размещение шрифтов мимо precache — Task 1 (шаг 6) и Task 8 (шаг 4). Строка сверки — Task 3 и Task 6. `fit()` вместо сплющивания — Task 2. Двухпроходный рендер — Task 2. Смешанные валюты — Task 3 и Task 6. OG: обрезка, высота от числа строк, `tspan`, плюрализация — Task 5–7. Вынос общих примитивов — Task 2 и Task 5. Тесты перечислены в каждой задаче.

**Открытый риск.** Task 7 шаг 1 требует сначала прочитать текущий сервис: точная форма `SharedReceiptPayload` (есть ли `itemCount` у участника) по коду не проверялась, и тест написан по предположению. Если поля другие — править тест и шаг 4 по факту, а не подгонять payload под тест.
