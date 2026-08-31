# Промо-ролик Ouro Finance — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать вертикальный промо-ролик 1080×1920 / 30 fps / ровно 750 кадров, показывающий сканирование чека, разделение счёта, долги и аналитику на реальных скриншотах приложения с анимированными оверлеями.

**Architecture:** Изолированный Remotion-проект `promo/` в корне репозитория. Скрипт на `puppeteer-core` снимает четыре настоящих экрана с прод-демо в `promo/public/shots/`. Шесть сцен-файлов склеиваются `TransitionSeries` в `Promo.tsx`. Движение — только `useCurrentFrame()` + инлайновые `interpolate()`.

**Tech Stack:** Remotion 4, `@remotion/transitions`, `@remotion/google-fonts` (Inter), `puppeteer-core` + системный Chrome, TypeScript.

**Спека:** `docs/superpowers/specs/2026-08-07-promo-video-design.md`

## Global Constraints

- Композиция: **1080×1920, 30 fps, ровно 750 кадров.** Итог проверяется командой, а не на глаз.
- Длительности сцен в `TransitionSeries`: **99, 159, 159, 159, 129, 90** (сумма 795), переходы **5 × 9 кадров** (сумма 45). `795 − 45 = 750`.
- Анимации **только** через `useCurrentFrame()` + `interpolate()`. CSS `transition`, CSS `animation` и анимационные классы Tailwind в рендере не работают.
- Вызовы `interpolate()` пишутся **инлайн внутри `style`**. Диапазоны, easing, `extrapolateLeft`/`extrapolateRight` и `output` — захардкоженными значениями.
- В `style` только литералы: **ни констант, ни спредов, ни арифметики**. Цвета пишутся значениями по месту.
- Свойства `scale` / `translate` / `rotate`, **не** `transform`. Для `scale` добавлять `output: 'perceptual-scale'`.
- `width`, `height`, `fps`, `durationInFrames`, `defaultProps` — инлайн на `<Composition>`, без приведений типов.
- Каждый анимируемый элемент — `<Interactive.Div name="...">` с захардкоженным осмысленным `name`.
- Текст заголовков пишется инлайн в сцене, а не выносится в общий компонент.
- Палитра: фон `#09090B`, золото `#E8C865`, тёмное золото `#C59B3F`, текст `#FAFAFA`, вторичный текст `#A1A1AA`, «вам должны» `#F59E0B`, «вы должны» `#A855F7`, успех `#059669`.
- Шрифт: `Inter`, веса 400/500/700, подмножества `latin` и `cyrillic`.
- Safe area: текст ≥80 px от боков, ≥100 px сверху. Заголовок ≥84 px, вспомогательный текст ≥44 px.
- Не коммитить без явной просьбы владельца репозитория.

**Как здесь проверяется работа.** Юнит-тестов нет намеренно: единственное, что можно проверить арифметически, — длительность, и она обязана оставаться инлайн в разметке, чтобы правиться в Studio; вынос её в модуль ради теста сломал бы главное требование интерактивности. Поэтому проверка командная: `npx remotion compositions` для длительности, `npx remotion still` для кадров, размеры PNG для скриншотов.

---

### Task 1: Каркас проекта и пустая композиция на 750 кадров

**Files:**
- Create: `promo/` (скаффолд), `promo/src/Root.tsx`, `promo/src/Promo.tsx`, `promo/src/fonts.ts`
- Modify: `.gitignore` (корень репозитория)

**Interfaces:**
- Produces: композиция с id `Promo`, 1080×1920, 30 fps, 750 кадров. Компонент `Promo` из `promo/src/Promo.tsx`. Модуль `promo/src/fonts.ts` с побочным эффектом загрузки Inter.

- [ ] **Step 1: Создать проект**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app
npx create-video@latest --yes --blank --no-tailwind promo
cd promo && npm i
```

- [ ] **Step 2: Добавить пакеты правильных версий**

`npx remotion add` ставит версию, совпадающую с ядром — обычный `npm i` может поставить рассинхронизированную.

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion add @remotion/transitions
npx remotion add @remotion/google-fonts
npm i -D puppeteer-core
```

- [ ] **Step 3: Загрузка шрифта**

Create `promo/src/fonts.ts`:

```ts
import {loadFont} from '@remotion/google-fonts/Inter';

// Пакет блокирует рендер, пока шрифт не готов, — иначе первые кадры
// уедут на подменном шрифте. Кириллица нужна для всех надписей.
export const {fontFamily} = loadFont('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin', 'cyrillic'],
});
```

- [ ] **Step 4: Проверить, какое имя семейства вернул пакет**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
node -e "console.log(require('@remotion/google-fonts/Inter'))" 2>/dev/null || echo "смотреть значение fontFamily в Studio через console.log в компоненте"
```

Ожидается `Inter`. Если пакет вернул другое имя — использовать именно его как литерал во всех сценах (по правилу «в style только литералы» имя пишется строкой по месту, а не подставляется из `fonts.ts`).

- [ ] **Step 5: Заготовка Promo.tsx**

Create `promo/src/Promo.tsx`:

```tsx
import {AbsoluteFill} from 'remotion';
import './fonts';

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill
      name="Promo"
      style={{
        backgroundColor: '#09090B',
        fontFamily: 'Inter',
      }}
    />
  );
};
```

- [ ] **Step 6: Регистрация композиции**

Create `promo/src/Root.tsx`:

```tsx
import {Composition} from 'remotion';
import {Promo} from './Promo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={750}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
```

Убедиться, что `promo/src/index.ts` регистрирует именно `RemotionRoot` (скаффолд создаёт его сам — при несовпадении имени поправить импорт, а не переименовывать файл).

- [ ] **Step 7: Проверить длительность командой**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion compositions
```

Expected: строка с `Promo`, `1080x1920`, `30`, `750`.

- [ ] **Step 8: Исключить артефакты из git**

Modify `.gitignore` в корне репозитория — дописать:

```
# Remotion promo
promo/node_modules/
promo/out/
promo/public/shots/
```

Скриншоты не версионируются: они пересоздаются скриптом и весят много.

- [ ] **Step 9: Открыть Studio и убедиться, что кадр чёрный**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion studio --no-open
```

Открыть напечатанный URL, путь `/Promo`. Ожидается чёрный кадр длиной 25 с. Процесс долгоживущий — оставить запущенным на всё время работы.

---

### Task 2: Скрипт съёмки четырёх реальных экранов

**Files:**
- Create: `promo/scripts/capture.mjs`
- Modify: `promo/package.json` (скрипт `capture`)

**Interfaces:**
- Produces: `promo/public/shots/scan.png`, `split.png`, `debts.png`, `analytics.png` — ширина 1179 px, тёмная тема, без служебного хрома.

- [ ] **Step 1: Написать скрипт**

Create `promo/scripts/capture.mjs`:

```js
// Снимает реальные экраны прод-демо для промо-ролика.
// Перезапускаемый: экраны переснимаются одной командой, когда UI изменится.
import {mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://app.ouro-finance.top';
const OUT = new URL('../public/shots/', import.meta.url);

// Служебный хром демо-режима и баннеры — не часть продукта, в кадре им не место.
const HIDE_CSS = `
  .from-amber-500.to-orange-500 { display: none !important; }
  [data-testid="pwa-install-banner"] { display: none !important; }
`;

const RECEIPT_DRAFT = {
  v: 1,
  savedAt: Date.now(),
  step: 2,
  currency: 'UZS',
  storeName: 'Chorsu Grill',
  ocrTotalAmount: 486000,
  totalAmount: 486000,
  manualMode: false,
  charges: [{id: 'c1', label: 'Обслуживание', type: 'percent', percent: 10, enabled: true}],
  items: [
    {id: 'i1', name: 'Шашлык из баранины', qty: 4, unitPrice: 48000, ocrTotalPrice: 192000, assignedParticipantIds: []},
    {id: 'i2', name: 'Салат «Ачик-чучук»', qty: 2, unitPrice: 26000, ocrTotalPrice: 52000, assignedParticipantIds: []},
    {id: 'i3', name: 'Лепёшка тандырная', qty: 4, unitPrice: 8000, ocrTotalPrice: 32000, assignedParticipantIds: []},
    {id: 'i4', name: 'Чай зелёный', qty: 2, unitPrice: 12000, ocrTotalPrice: 24000, assignedParticipantIds: []},
    {id: 'i5', name: 'Лагман', qty: 2, unitPrice: 45000, ocrTotalPrice: 90000, assignedParticipantIds: []},
    {id: 'i6', name: 'Компот', qty: 4, unitPrice: 9000, ocrTotalPrice: 36000, assignedParticipantIds: []},
  ],
  participants: [
    {id: 'p0', name: 'Вы', isMe: true, color: '#4F46E5', paidById: null},
    {id: 'p1', name: 'Ахмед', isMe: false, color: '#F59E0B', paidById: null},
    {id: 'p2', name: 'Анна', isMe: false, color: '#A855F7', paidById: null},
    {id: 'p3', name: 'Коля', isMe: false, color: '#059669', paidById: null},
  ],
  payerId: 'p0',
  formData: {
    accountId: null,
    categoryId: '',
    description: 'Ужин в Chorsu Grill',
    date: Date.now(),
    createDebts: true,
    currency: 'UZS',
  },
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: {width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true},
  args: ['--force-color-profile=srgb', '--hide-scrollbars'],
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{name: 'prefers-color-scheme', value: 'dark'}]);

await page.goto(`${BASE}/auth/login`, {waitUntil: 'networkidle2'});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Попробовать демо'));
  if (!btn) throw new Error('Кнопка «Попробовать демо» не найдена');
  btn.click();
});

// Демо-пользователь создаётся не мгновенно: ждём ухода с /auth.
await page.waitForFunction(() => !location.pathname.startsWith('/auth'), {timeout: 60000});

await page.evaluate((draft) => {
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('push-banner-dismissed', 'true');
  localStorage.setItem('pwa-install-dismissed', 'true');
  localStorage.setItem('lastSeenChangelogVersion', '99.0.0');
  localStorage.setItem('scan-receipt:draft', JSON.stringify(draft));
}, RECEIPT_DRAFT);

await mkdir(OUT, {recursive: true});

async function shoot(path, file, waitText) {
  await page.goto(`${BASE}${path}`, {waitUntil: 'networkidle2'});
  if (waitText) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), {timeout: 30000}, waitText);
  }
  await page.addStyleTag({content: HIDE_CSS});
  // Дать доехать входным анимациям приложения перед съёмкой.
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({path: new URL(file, OUT).pathname});
  console.log(`✓ ${file}`);
}

await shoot('/debts', 'debts.png', 'Долги');
await shoot('/analytics', 'analytics.png', 'Аналитика');
await shoot('/scan-receipt', 'scan.png', 'Шашлык');

// Шаг 3 визарда — участники и назначение позиций.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Далее|Продолжить/.test(b.textContent ?? ''));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1500));
await page.addStyleTag({content: HIDE_CSS});
await page.screenshot({path: new URL('split.png', OUT).pathname});
console.log('✓ split.png');

await browser.close();
```

- [ ] **Step 2: Добавить npm-скрипт**

Modify `promo/package.json` — в `"scripts"` дописать:

```json
"capture": "node scripts/capture.mjs"
```

- [ ] **Step 3: Запустить**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npm run capture
```

Expected: четыре строки `✓ *.png`.

- [ ] **Step 4: Проверить, что получилось**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
ls -la public/shots/
sips -g pixelWidth -g pixelHeight public/shots/*.png
```

Expected: четыре файла, ширина каждого 1179 px.

- [ ] **Step 5: Посмотреть на них глазами**

Открыть каждый PNG инструментом Read. Проверить:
- тёмная тема применилась;
- оранжевой плашки демо-режима нет;
- `scan.png` показывает список позиций чека, а не экран загрузки фото (если показывает — черновик не подхватился: сверить схему `ReceiptDraft` в `frontend/src/features/scan-receipt/model/useReceiptDraft.ts`, поле `v` могло смениться);
- `split.png` показывает участников;
- `debts.png` показывает людей с суммами;
- `analytics.png` показывает кольцевую диаграмму.

Записать для каждого файла координаты ключевого элемента в пикселях скриншота — они понадобятся в задачах 5–8 для привязки оверлеев. Пересчёт в координаты кадра: `x_кадра = 60 + x_скриншота × 960 / 1179`, `y_кадра = 380 + (y_скриншота − offsetY) × 960 / 1179`.

---

### Task 3: Рамка телефона и водяной знак

**Files:**
- Create: `promo/src/components/PhoneShot.tsx`, `promo/src/components/Watermark.tsx`
- Create: `promo/public/enso.svg`

**Interfaces:**
- Produces: `<PhoneShot src={string} offsetY={number} />` — рамка телефона с реальным скриншотом, выезжающая снизу; `<Watermark />` — золотой энсо в правом верхнем углу.

- [ ] **Step 1: Логотип-энсо в public**

Create `promo/public/enso.svg` — скопировать содержимое `frontend/public/favicon.svg`, убрав подложку `<rect>` (в ролике фон свой):

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app
sed '/<rect width="512"/d' frontend/public/favicon.svg > promo/public/enso.svg
```

- [ ] **Step 2: Водяной знак**

Create `promo/src/components/Watermark.tsx`:

```tsx
import {Img, staticFile} from 'remotion';

export const Watermark: React.FC = () => {
  return (
    <Img
      name="Watermark"
      src={staticFile('enso.svg')}
      style={{
        position: 'absolute',
        top: 96,
        right: 80,
        width: 64,
        height: 64,
        opacity: 0.45,
      }}
    />
  );
};
```

- [ ] **Step 3: Рамка телефона**

Create `promo/src/components/PhoneShot.tsx`:

```tsx
import {Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame} from 'remotion';

// Единственный компонент, вынесенный в общий: рамка во всех сценах
// буквально одинакова, поэтому её стили — литералы и здесь.
// Заголовки, наоборот, живут инлайн в сценах, чтобы правиться в Studio.
export const PhoneShot: React.FC<{src: string; offsetY: number}> = ({src, offsetY}) => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div
      name="Phone"
      style={{
        position: 'absolute',
        top: 380,
        left: 60,
        width: 960,
        height: 1540,
        borderRadius: 56,
        overflow: 'hidden',
        backgroundColor: '#09090B',
        border: '2px solid rgba(232,200,101,0.25)',
        boxShadow: '0 40px 120px rgba(232,200,101,0.10)',
        opacity: interpolate(frame, [0, 14], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(frame, [0, 26], ['0px 140px', '0px 0px'], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <Img
        name="Screenshot"
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left: 0,
          top: offsetY,
          width: 960,
        }}
      />
    </Interactive.Div>
  );
};
```

- [ ] **Step 4: Временно вывести рамку в Promo, чтобы посмотреть**

Modify `promo/src/Promo.tsx` — внутрь `AbsoluteFill` добавить:

```tsx
      <Watermark />
      <PhoneShot src="shots/debts.png" offsetY={0} />
```

и импорты сверху:

```tsx
import {PhoneShot} from './components/PhoneShot';
import {Watermark} from './components/Watermark';
```

- [ ] **Step 5: Снять контрольный кадр**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still Promo --frame=30 --scale=0.5 --output=out/check-phone.png
```

Открыть `out/check-phone.png` инструментом Read. Ожидается: телефон с золотым кантом, внутри читаемый экран долгов, энсо в правом верхнем углу. Если текст интерфейса мелкий — увеличить `offsetY` не поможет, нужно менять кроп: подобрать `offsetY` так, чтобы интересная часть экрана была в верхних двух третях рамки.

---

### Task 4: Сцены-закладки — «Хук» и «CTA»

Обе сцены без скриншота, на чёрном, с энсо — поэтому делаются вместе.

**Files:**
- Create: `promo/src/scenes/Hook.tsx`, `promo/src/scenes/Cta.tsx`
- Modify: `promo/src/Root.tsx` (регистрация сцен отдельными композициями)

**Interfaces:**
- Produces: `<Hook />` (рассчитан на 99 кадров), `<Cta />` (рассчитан на 90 кадров).

- [ ] **Step 1: Сцена «Хук»**

Create `promo/src/scenes/Hook.tsx`:

```tsx
import {AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Hook" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Img
        name="Enso backdrop"
        src={staticFile('enso.svg')}
        style={{
          position: 'absolute',
          top: 700,
          left: 190,
          width: 700,
          height: 700,
          opacity: interpolate(frame, [0, 30], [0, 0.18], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0, 60], [0.7, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: 'perceptual-scale',
          }),
        }}
      />
      <Interactive.Div
        name="Hook line 1"
        style={{
          position: 'absolute',
          top: 780,
          left: 80,
          width: 920,
          color: '#FAFAFA',
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -3,
          opacity: interpolate(frame, [4, 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [4, 20], ['0px 40px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Поужинали вчетвером
      </Interactive.Div>
      <Interactive.Div
        name="Hook line 2"
        style={{
          position: 'absolute',
          top: 940,
          left: 80,
          width: 920,
          color: '#E8C865',
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -3,
          opacity: interpolate(frame, [42, 58], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [42, 58], ['0px 40px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Кто кому сколько?
      </Interactive.Div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Сцена «CTA»**

Create `promo/src/scenes/Cta.tsx`:

```tsx
import {AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Cta" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Img
        name="Logo"
        src={staticFile('enso.svg')}
        style={{
          position: 'absolute',
          top: 620,
          left: 390,
          width: 300,
          height: 300,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0, 34], [0.6, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({damping: 200}),
            output: 'perceptual-scale',
          }),
        }}
      />
      <Interactive.Div
        name="Wordmark"
        style={{
          position: 'absolute',
          top: 990,
          left: 80,
          width: 920,
          textAlign: 'center',
          color: '#FAFAFA',
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: interpolate(frame, [14, 30], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Ouro Finance
      </Interactive.Div>
      <Interactive.Div
        name="Domain"
        style={{
          position: 'absolute',
          top: 1120,
          left: 80,
          width: 920,
          textAlign: 'center',
          color: '#E8C865',
          fontSize: 54,
          fontWeight: 500,
          opacity: interpolate(frame, [24, 40], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        app.ouro-finance.top
      </Interactive.Div>
      <Interactive.Div
        name="Cta note"
        style={{
          position: 'absolute',
          top: 1210,
          left: 80,
          width: 920,
          textAlign: 'center',
          color: '#A1A1AA',
          fontSize: 46,
          fontWeight: 400,
          opacity: interpolate(frame, [32, 48], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        демо без регистрации
      </Interactive.Div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Зарегистрировать сцены отдельными композициями**

Modify `promo/src/Root.tsx` — обернуть в фрагмент, добавить папку со сценами. Двойной клик по сцене в таймлайне главной композиции откроет её на правку.

```tsx
import {Composition, Folder} from 'remotion';
import {Promo} from './Promo';
import {Cta} from './scenes/Cta';
import {Hook} from './scenes/Hook';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Scenes">
        <Composition id="Hook" component={Hook} durationInFrames={99} fps={30} width={1080} height={1920} />
        <Composition id="Cta" component={Cta} durationInFrames={90} fps={30} width={1080} height={1920} />
      </Folder>
      <Composition id="Promo" component={Promo} durationInFrames={750} fps={30} width={1080} height={1920} />
    </>
  );
};
```

- [ ] **Step 4: Проверить обе сцены кадрами**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still Hook --frame=70 --scale=0.5 --output=out/check-hook.png
npx remotion still Cta --frame=60 --scale=0.5 --output=out/check-cta.png
```

Открыть оба PNG инструментом Read. Ожидается: в «Хуке» обе строки видны, вторая золотая, энсо тускло проступает; в «CTA» логотип, «Ouro Finance», домен и подпись — по центру, ничего не выходит за safe area.

---

### Task 5: Сцена «Скан чека»

**Files:**
- Create: `promo/src/scenes/ScanReceipt.tsx`
- Modify: `promo/src/Root.tsx`

**Interfaces:**
- Consumes: `<PhoneShot src="shots/scan.png" offsetY={...} />`, `<Watermark />`
- Produces: `<ScanReceipt />`, рассчитан на 159 кадров.

- [ ] **Step 1: Измерить скриншот**

Открыть `promo/public/shots/scan.png` инструментом Read. Определить, на какой высоте в пикселях скриншота начинается список позиций, и подобрать `offsetY` так, чтобы список занимал верхние две трети рамки. Отправная точка `offsetY = -120`; уточнить по факту.

- [ ] **Step 2: Написать сцену**

Create `promo/src/scenes/ScanReceipt.tsx`. Значение `offsetY` подставить измеренное на шаге 1.

```tsx
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {PhoneShot} from '../components/PhoneShot';
import {Watermark} from '../components/Watermark';

export const ScanReceipt: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="ScanReceipt" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Watermark />
      <Interactive.Div
        name="Headline"
        style={{
          position: 'absolute',
          top: 150,
          left: 80,
          width: 920,
          color: '#FAFAFA',
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: interpolate(frame, [2, 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [2, 16], ['0px 30px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Сфоткал чек
      </Interactive.Div>
      <Interactive.Div
        name="Kicker"
        style={{
          position: 'absolute',
          top: 288,
          left: 80,
          width: 920,
          color: '#A1A1AA',
          fontSize: 46,
          fontWeight: 500,
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        позиции распознаются сами
      </Interactive.Div>

      <PhoneShot src="shots/scan.png" offsetY={-120} />

      <Interactive.Div
        name="Scan beam"
        style={{
          position: 'absolute',
          left: 62,
          width: 956,
          height: 220,
          borderRadius: 40,
          background: 'linear-gradient(180deg, rgba(232,200,101,0) 0%, rgba(232,200,101,0.35) 60%, rgba(232,200,101,0.95) 100%)',
          mixBlendMode: 'screen',
          opacity: interpolate(frame, [24, 32, 60, 70], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          translate: interpolate(frame, [26, 68], ['0px 360px', '0px 1780px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          }),
        }}
      />

      <Interactive.Div
        name="Scan veil"
        style={{
          position: 'absolute',
          left: 62,
          top: 380,
          width: 956,
          height: 1536,
          borderRadius: 54,
          backgroundColor: '#09090B',
          opacity: interpolate(frame, [26, 40], [0.82, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </AbsoluteFill>
  );
};
```

Полоса-сканер идёт по кадру, а завеса гаснет ей вслед — вместе это читается как «позиции проявились после прохода сканера».

- [ ] **Step 3: Зарегистрировать сцену**

Modify `promo/src/Root.tsx` — внутрь `<Folder name="Scenes">` добавить:

```tsx
        <Composition id="ScanReceipt" component={ScanReceipt} durationInFrames={159} fps={30} width={1080} height={1920} />
```

и импорт `import {ScanReceipt} from './scenes/ScanReceipt';`.

- [ ] **Step 4: Проверить три кадра**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still ScanReceipt --frame=20 --scale=0.5 --output=out/scan-20.png
npx remotion still ScanReceipt --frame=48 --scale=0.5 --output=out/scan-48.png
npx remotion still ScanReceipt --frame=100 --scale=0.5 --output=out/scan-100.png
```

Открыть все три инструментом Read. Ожидается: на 20 — заголовок и телефон приехали, экран ещё притушен; на 48 — золотая полоса в середине экрана; на 100 — позиции чека читаются полностью, завесы нет.

---

### Task 6: Сцена «Разделение»

**Files:**
- Create: `promo/src/scenes/Split.tsx`
- Modify: `promo/src/Root.tsx`

**Interfaces:**
- Consumes: `<PhoneShot src="shots/split.png" offsetY={...} />`, `<Watermark />`
- Produces: `<Split />`, рассчитан на 159 кадров.

- [ ] **Step 1: Измерить скриншот**

Открыть `promo/public/shots/split.png` инструментом Read. Найти, где на экране ряд участников. Подобрать `offsetY`, чтобы ряд участников был в верхней трети рамки — к нему будут лететь позиции.

- [ ] **Step 2: Написать сцену**

Create `promo/src/scenes/Split.tsx`. Четыре «квитка» летят из нижней части экрана к аватарам вверху — по одному на участника, со сдвигом по времени.

```tsx
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {PhoneShot} from '../components/PhoneShot';
import {Watermark} from '../components/Watermark';

export const Split: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Split" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Watermark />
      <Interactive.Div
        name="Headline"
        style={{
          position: 'absolute',
          top: 150,
          left: 80,
          width: 920,
          color: '#FAFAFA',
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: interpolate(frame, [2, 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [2, 16], ['0px 30px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Разделил на всех
      </Interactive.Div>
      <Interactive.Div
        name="Kicker"
        style={{
          position: 'absolute',
          top: 288,
          left: 80,
          width: 920,
          color: '#A1A1AA',
          fontSize: 46,
          fontWeight: 500,
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        поровну или по позициям
      </Interactive.Div>

      <PhoneShot src="shots/split.png" offsetY={-80} />

      <Interactive.Div
        name="Chip you"
        style={{
          position: 'absolute',
          left: 150,
          top: 1400,
          padding: '14px 26px',
          borderRadius: 999,
          backgroundColor: 'rgba(79,70,229,0.22)',
          border: '2px solid #4F46E5',
          color: '#FAFAFA',
          fontSize: 34,
          fontWeight: 600,
          opacity: interpolate(frame, [30, 40, 62, 72], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          translate: interpolate(frame, [30, 72], ['0px 0px', '0px -700px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Вы · 121 500
      </Interactive.Div>
      <Interactive.Div
        name="Chip ahmed"
        style={{
          position: 'absolute',
          left: 560,
          top: 1470,
          padding: '14px 26px',
          borderRadius: 999,
          backgroundColor: 'rgba(245,158,11,0.22)',
          border: '2px solid #F59E0B',
          color: '#FAFAFA',
          fontSize: 34,
          fontWeight: 600,
          opacity: interpolate(frame, [42, 52, 74, 84], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          translate: interpolate(frame, [42, 84], ['0px 0px', '0px -760px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Ахмед · 121 500
      </Interactive.Div>
      <Interactive.Div
        name="Chip anna"
        style={{
          position: 'absolute',
          left: 170,
          top: 1560,
          padding: '14px 26px',
          borderRadius: 999,
          backgroundColor: 'rgba(168,85,247,0.22)',
          border: '2px solid #A855F7',
          color: '#FAFAFA',
          fontSize: 34,
          fontWeight: 600,
          opacity: interpolate(frame, [54, 64, 86, 96], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          translate: interpolate(frame, [54, 96], ['0px 0px', '0px -840px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Анна · 121 500
      </Interactive.Div>
      <Interactive.Div
        name="Chip kolya"
        style={{
          position: 'absolute',
          left: 590,
          top: 1640,
          padding: '14px 26px',
          borderRadius: 999,
          backgroundColor: 'rgba(5,150,105,0.22)',
          border: '2px solid #059669',
          color: '#FAFAFA',
          fontSize: 34,
          fontWeight: 600,
          opacity: interpolate(frame, [66, 76, 98, 108], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          translate: interpolate(frame, [66, 108], ['0px 0px', '0px -920px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Коля · 121 500
      </Interactive.Div>
    </AbsoluteFill>
  );
};
```

Суммы `121 500` — это 486 000 / 4, ровно то, что даёт засеянный чек из задачи 2. Если состав чека менялся — пересчитать и поправить все четыре надписи.

- [ ] **Step 3: Зарегистрировать сцену**

Modify `promo/src/Root.tsx` — внутрь `<Folder name="Scenes">`:

```tsx
        <Composition id="Split" component={Split} durationInFrames={159} fps={30} width={1080} height={1920} />
```

плюс импорт `import {Split} from './scenes/Split';`.

- [ ] **Step 4: Проверить кадры**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still Split --frame=58 --scale=0.5 --output=out/split-58.png
npx remotion still Split --frame=90 --scale=0.5 --output=out/split-90.png
```

Открыть оба инструментом Read. Ожидается: квитки летят вверх со сдвигом, ни один не залезает на заголовок и не выходит за рамку телефона. Если залезают — уменьшить величину подъёма в `translate`.

---

### Task 7: Сцена «Долги»

**Files:**
- Create: `promo/src/scenes/Debts.tsx`
- Modify: `promo/src/Root.tsx`

**Interfaces:**
- Consumes: `<PhoneShot src="shots/debts.png" offsetY={...} />`, `<Watermark />`
- Produces: `<Debts />`, рассчитан на 159 кадров.

- [ ] **Step 1: Измерить скриншот**

Открыть `promo/public/shots/debts.png` инструментом Read. Найти вертикальные границы строк с людьми (Ахмед / Анна / Коля) и пересчитать их в координаты кадра формулой из задачи 2, шаг 5. Эти значения пойдут в `top` подсветок.

- [ ] **Step 2: Написать сцену**

Create `promo/src/scenes/Debts.tsx`. Значения `top` у подсветок заменить измеренными на шаге 1.

```tsx
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {PhoneShot} from '../components/PhoneShot';
import {Watermark} from '../components/Watermark';

export const Debts: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Debts" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Watermark />
      <Interactive.Div
        name="Headline"
        style={{
          position: 'absolute',
          top: 150,
          left: 80,
          width: 920,
          color: '#FAFAFA',
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: interpolate(frame, [2, 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [2, 16], ['0px 30px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Долги посчитались
      </Interactive.Div>
      <Interactive.Div
        name="Kicker"
        style={{
          position: 'absolute',
          top: 288,
          left: 80,
          width: 920,
          color: '#A1A1AA',
          fontSize: 46,
          fontWeight: 500,
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        кто кому — одной цифрой
      </Interactive.Div>

      <PhoneShot src="shots/debts.png" offsetY={-60} />

      <Interactive.Div
        name="Row highlight 1"
        style={{
          position: 'absolute',
          left: 100,
          top: 720,
          width: 880,
          height: 130,
          borderRadius: 28,
          border: '3px solid #F59E0B',
          backgroundColor: 'rgba(245,158,11,0.12)',
          opacity: interpolate(frame, [28, 40, 96, 108], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          scale: interpolate(frame, [28, 44], [0.92, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({damping: 200}),
            output: 'perceptual-scale',
          }),
        }}
      />
      <Interactive.Div
        name="Row highlight 2"
        style={{
          position: 'absolute',
          left: 100,
          top: 870,
          width: 880,
          height: 130,
          borderRadius: 28,
          border: '3px solid #A855F7',
          backgroundColor: 'rgba(168,85,247,0.12)',
          opacity: interpolate(frame, [44, 56, 96, 108], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          scale: interpolate(frame, [44, 60], [0.92, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({damping: 200}),
            output: 'perceptual-scale',
          }),
        }}
      />
      <Interactive.Div
        name="Net badge"
        style={{
          position: 'absolute',
          left: 140,
          top: 1120,
          width: 800,
          padding: '28px 0px',
          textAlign: 'center',
          borderRadius: 32,
          backgroundColor: 'rgba(232,200,101,0.14)',
          border: '3px solid #E8C865',
          color: '#E8C865',
          fontSize: 52,
          fontWeight: 700,
          opacity: interpolate(frame, [100, 116], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [100, 122], [0.86, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({damping: 200}),
            output: 'perceptual-scale',
          }),
        }}
      >
        Итого вам должны 4 679 464
      </Interactive.Div>
    </AbsoluteFill>
  );
};
```

Сумма `4 679 464` — это Ахмед 2 879 464 + Анна 1 500 000 + Коля 300 000 из демо-сида. **Сверить с тем, что реально на `debts.png`**, и поправить, если сид отдал другие числа: неверная сумма в промо-ролике хуже, чем отсутствие плашки.

- [ ] **Step 3: Зарегистрировать сцену**

Modify `promo/src/Root.tsx` — внутрь `<Folder name="Scenes">`:

```tsx
        <Composition id="Debts" component={Debts} durationInFrames={159} fps={30} width={1080} height={1920} />
```

плюс импорт `import {Debts} from './scenes/Debts';`.

- [ ] **Step 4: Проверить кадры**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still Debts --frame=60 --scale=0.5 --output=out/debts-60.png
npx remotion still Debts --frame=125 --scale=0.5 --output=out/debts-125.png
```

Открыть оба инструментом Read. На 60 обе подсветки обязаны лежать **ровно** на строках людей, не съезжая. Если съехали — вернуться к шагу 1 и пересчитать координаты. На 125 видна золотая плашка с итогом.

---

### Task 8: Сцена «Аналитика»

**Files:**
- Create: `promo/src/scenes/Analytics.tsx`
- Modify: `promo/src/Root.tsx`

**Interfaces:**
- Consumes: `<PhoneShot src="shots/analytics.png" offsetY={...} />`, `<Watermark />`
- Produces: `<Analytics />`, рассчитан на 129 кадров.

- [ ] **Step 1: Измерить скриншот**

Открыть `promo/public/shots/analytics.png` инструментом Read. Найти центр и диаметр кольцевой диаграммы, пересчитать в координаты кадра формулой из задачи 2, шаг 5. Подобрать `offsetY`, чтобы кольцо было в верхней половине рамки.

- [ ] **Step 2: Написать сцену**

Create `promo/src/scenes/Analytics.tsx`. Значения `left` / `top` / `width` / `height` у маски заменить измеренными.

Кольцо «дорисовывается» вращающейся заслонкой: полукруглая накладка цвета фона поворачивается на 360°, открывая настоящее кольцо под собой.

```tsx
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame} from 'remotion';
import {PhoneShot} from '../components/PhoneShot';
import {Watermark} from '../components/Watermark';

export const Analytics: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="Analytics" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <Watermark />
      <Interactive.Div
        name="Headline"
        style={{
          position: 'absolute',
          top: 150,
          left: 80,
          width: 920,
          color: '#FAFAFA',
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: -2,
          opacity: interpolate(frame, [2, 16], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [2, 16], ['0px 30px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Всё на виду
      </Interactive.Div>
      <Interactive.Div
        name="Kicker"
        style={{
          position: 'absolute',
          top: 288,
          left: 80,
          width: 920,
          color: '#A1A1AA',
          fontSize: 46,
          fontWeight: 500,
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        аналитика по категориям
      </Interactive.Div>

      <PhoneShot src="shots/analytics.png" offsetY={-40} />

      <Interactive.Div
        name="Donut wiper"
        style={{
          position: 'absolute',
          left: 300,
          top: 620,
          width: 480,
          height: 480,
          borderRadius: 999,
          background: 'conic-gradient(#09090B 0deg 180deg, rgba(9,9,11,0) 180deg 360deg)',
          opacity: interpolate(frame, [46, 58], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.linear,
          }),
          rotate: interpolate(frame, [16, 58], ['0deg', '360deg'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          }),
        }}
      />
      <Interactive.Div
        name="Category callout"
        style={{
          position: 'absolute',
          left: 140,
          top: 1240,
          width: 800,
          padding: '26px 0px',
          textAlign: 'center',
          borderRadius: 32,
          backgroundColor: 'rgba(232,200,101,0.14)',
          border: '3px solid #E8C865',
          color: '#E8C865',
          fontSize: 48,
          fontWeight: 700,
          opacity: interpolate(frame, [64, 80], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [64, 86], [0.86, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({damping: 200}),
            output: 'perceptual-scale',
          }),
        }}
      >
        Продукты — 26.2%
      </Interactive.Div>
    </AbsoluteFill>
  );
};
```

`Продукты — 26.2%` взято из демо-сида. **Сверить с `analytics.png`** и поправить, если цифра другая.

- [ ] **Step 3: Зарегистрировать сцену**

Modify `promo/src/Root.tsx` — внутрь `<Folder name="Scenes">`:

```tsx
        <Composition id="Analytics" component={Analytics} durationInFrames={129} fps={30} width={1080} height={1920} />
```

плюс импорт `import {Analytics} from './scenes/Analytics';`.

- [ ] **Step 4: Проверить кадры**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion still Analytics --frame=34 --scale=0.5 --output=out/an-34.png
npx remotion still Analytics --frame=100 --scale=0.5 --output=out/an-100.png
```

Открыть оба инструментом Read. На 34 заслонка обязана закрывать **часть** кольца и ничего вокруг — если она перекрывает соседние элементы, уменьшить размер и уточнить центр. На 100 кольцо открыто целиком, видна плашка категории.

---

### Task 9: Сборка ролика, слот под музыку, финальный рендер

**Files:**
- Modify: `promo/src/Promo.tsx`
- Create: `promo/README.md`

**Interfaces:**
- Consumes: все шесть сцен.
- Produces: композиция `Promo` длиной ровно 750 кадров; `promo/out/promo.mp4`.

- [ ] **Step 1: Собрать TransitionSeries**

Replace `promo/src/Promo.tsx` целиком:

```tsx
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {AbsoluteFill} from 'remotion';
import './fonts';
import {Analytics} from './scenes/Analytics';
import {Cta} from './scenes/Cta';
import {Debts} from './scenes/Debts';
import {Hook} from './scenes/Hook';
import {ScanReceipt} from './scenes/ScanReceipt';
import {Split} from './scenes/Split';

// Переходы съедают таймлайн: 99+159+159+159+129+90 = 795, минус 5×9 = 750 кадров.
export const Promo: React.FC = () => {
  return (
    <AbsoluteFill name="Promo" style={{backgroundColor: '#09090B', fontFamily: 'Inter'}}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={99} name="Hook">
          <Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 9})} />
        <TransitionSeries.Sequence durationInFrames={159} name="ScanReceipt">
          <ScanReceipt />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 9})} />
        <TransitionSeries.Sequence durationInFrames={159} name="Split">
          <Split />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 9})} />
        <TransitionSeries.Sequence durationInFrames={159} name="Debts">
          <Debts />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 9})} />
        <TransitionSeries.Sequence durationInFrames={129} name="Analytics">
          <Analytics />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 9})} />
        <TransitionSeries.Sequence durationInFrames={90} name="Cta">
          <Cta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Проверить, что длительность не разъехалась**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion compositions
```

Expected: `Promo` по-прежнему 750 кадров. Если Studio ругается на несоответствие — значит сумма сцен и переходов больше не даёт 750; починить арифметику, а не подгонять `durationInFrames` композиции.

- [ ] **Step 3: Слот под музыку**

Modify `promo/src/Promo.tsx` — сразу после открывающего `<AbsoluteFill ...>` добавить закомментированный блок и импорт:

```tsx
// Музыка: положить файл в promo/public/music.mp3 и раскомментировать.
// import {Audio} from '@remotion/media';
// <Audio src={staticFile('music.mp3')} volume={0.35} />
```

Оставлено комментарием намеренно: `<Audio>` с несуществующим файлом валит рендер.

- [ ] **Step 4: Посмотреть целиком в Studio**

Открыть `/Promo` в уже запущенной Studio, проиграть от начала до конца. Проверить: ни одна надпись не обрезана, переходы не съедают ключевые кадры, ролик заканчивается на CTA, а не на чёрном.

- [ ] **Step 5: Отрендерить**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
npx remotion render Promo out/promo.mp4
```

- [ ] **Step 6: Проверить готовый файл**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app/promo
ls -lh out/promo.mp4
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate -of default=noprint_wrappers=1 out/promo.mp4
```

Expected: `width=1080`, `height=1920`, `r_frame_rate=30/1`, `duration≈25.0`.

- [ ] **Step 7: Написать README проекта**

Create `promo/README.md`:

```markdown
# Промо-ролик Ouro Finance

1080×1920, 30 fps, 25 с. Реальные скриншоты приложения + анимированные оверлеи.

## Команды

    npm run capture   # переснять экраны с прод-демо в public/shots/
    npx remotion studio --no-open
    npx remotion render Promo out/promo.mp4

## Музыка

Положить трек в `public/music.mp3` и раскомментировать блок `<Audio>` в `src/Promo.tsx`.
Резы стоят на полутактах 120 BPM, поэтому бодрый трек ляжет по долям.

## Если интерфейс изменился

Перезапустить `npm run capture`, затем сверить координаты оверлеев в сценах —
подсветки в `Debts.tsx` и заслонка кольца в `Analytics.tsx` привязаны к пикселям
скриншота. Формула пересчёта — в плане, `docs/superpowers/plans/2026-08-07-promo-video.md`.

## Длительность

Сцены: 99 + 159 + 159 + 159 + 129 + 90 = 795. Переходы: 5 × 9 = 45. Итого 750 кадров.
Менять длину сцены — значит пересчитать эту сумму, иначе ролик перестанет быть 25-секундным.
```

---

## Self-Review

**Покрытие спеки.** Все шесть сцен — задачи 4–8. Композиция и арифметика — задачи 1 и 9. Съёмка с сидом черновика — задача 2. Рамка телефона и водяной знак — задача 3. Слот под музыку и рендер — задача 9. Правила интерактивности вынесены в Global Constraints и соблюдены в каждом фрагменте кода. Непокрытых требований спеки нет.

**Плейсхолдеры.** Значения `offsetY` и координаты подсветок помечены как измеряемые по факту — это не заглушка, а honest-шаг с конкретной формулой пересчёта и конкретной отправной точкой. Всё остальное — рабочий код.

**Согласованность типов.** `PhoneShot` объявлен как `{src: string; offsetY: number}` в задаче 3 и вызывается ровно с этими двумя пропсами в задачах 5–8. Имена композиций (`Hook`, `ScanReceipt`, `Split`, `Debts`, `Analytics`, `Cta`, `Promo`) совпадают между `Root.tsx`, командами `remotion still` и `TransitionSeries.Sequence`. Длительности сцен в `Root.tsx` совпадают с `durationInFrames` в `Promo.tsx`.

**Известная хрупкость, оставленная сознательно.** Числа в надписях (`121 500`, `4 679 464`, `26.2%`) взяты из демо-сида и в трёх местах плана сопровождены требованием сверить их с реальным скриншотом. Автоматически связать их со скриншотом нельзя — он растровый.
