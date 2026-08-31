// Снимает реальные экраны локального инстанса для промо-ролика и замеряет
// рамки тех элементов, которые подсвечивают оверлеи.
// Перезапускаемый: экраны переснимаются одной командой, когда UI изменится.
//
// Порядок: вход демо-кнопкой → сид дописывает недостающие данные в ту же
// сессию → съёмка. Сид не логинится сам: токен живёт 15 минут, а refresh
// лежит в httpOnly-куке, которой у отдельного процесса нет.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Отдельный vite, а не обычный дев-сервер: в `frontend/.env` VITE_API_URL
// указывает на LAN-адрес машины (нужен для проверки с телефона), и по нему
// бэкенд с этой машины недоступен. Поднимать так:
//   cd frontend && VITE_API_URL=http://localhost:3000 bunx vite --port 5199
const BASE = process.env.PROMO_BASE ?? "http://localhost:5199";

// Язык съёмки. Английский собирается из трёх слоёв, и подмена в DOM — только
// третий, самый последний:
//   1. бэкенд отдаёт данные по `Accept-Language` (nestjs-i18n) — категории,
//      счета, контакты и описания операций приходят английскими по-настоящему;
//   2. фронт стартует с `locale=en` — даты, числа и уже извлечённые слайсы;
//   3. словарь подменяет то, что во фронте пока захардкожено по-русски.
// Порядок важен: чем больше берут на себя первые два слоя, тем меньше словарь
// и тем меньше в кадре того, чего приложение на самом деле не отдаёт.
//
// `--harvest` ничего не подменяет: он собирает все видимые строки прогона в
// scripts/harvest.json, чтобы словарь писался по факту, а не по памяти.
const LANG = process.argv.find((a) => a.startsWith("--lang="))?.slice(7) ?? "ru";
const HARVEST = process.argv.includes("--harvest");
const OUT = new URL(LANG === "ru" ? "../public/shots/" : `../public/shots/${LANG}/`, import.meta.url);
const DICT = LANG === "ru" ? { exact: {}, rules: [] } : JSON.parse(await readFile(new URL("./shot-strings.json", import.meta.url), "utf8"));

// Пробел в правиле означает «любой пробел»: между разрядами и перед единицей
// приложение ставит неразрывные, и правило, написанное обычным, молча
// промахнулось бы. Разворачиваем до компиляции — тогда и переводчик страницы
// получает уже готовые шаблоны.
DICT.rules = DICT.rules.map(([from, to]) => [from.replaceAll(" ", "[ \\u00a0\\u202f]"), to]);

// Та же логика, что у переводчика страницы: точное совпадение, иначе правила.
// Скрипт водит приложение по видимому тексту, а после подмены он английский.
const RULES = DICT.rules.map(([from, to]) => [new RegExp(from, "gu"), to]);
const t = (ru) => {
  if (DICT.exact[ru] !== undefined) return DICT.exact[ru];
  let out = ru;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
};
const CHANGELOG = new URL("../../frontend/src/features/changelog/model/changelogData.ts", import.meta.url);
const SEED = new URL("./seed.mjs", import.meta.url).pathname;

// Оверлеи лежат внутри слоя лупы, отрисованного один к одному с источником,
// поэтому единицы замера — пиксели источника: CSS-пиксель страницы × DPR 3.
// Смещения нет: угол слоя совпадает с углом скриншота.
const K = 3;
const OX = 0;
const OY = 0;

// Лупа показывает полосу высотой 720 px источника. Ставим её так, чтобы
// замеренный элемент оказался в середине, и зажимаем в границы скриншота.
const loupeTopFor = (b) => Math.max(0, Math.min(1836, Math.round(b.top + b.height / 2 - 360)));

// Модалка «Что нового» показывается, пока сохранённая версия !== текущей —
// сравнение строгое, поэтому подставлять «99.0.0» бесполезно. Берём версию
// из исходников фронта, чтобы не чинить это при каждом релизе.
const changelogSrc = await readFile(CHANGELOG, "utf8");
const versionMatch = changelogSrc.match(/CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) throw new Error("Не удалось прочитать CURRENT_VERSION из changelogData.ts");
const CURRENT_VERSION = versionMatch[1];

// Плашка демо-режима с таймером — служебный хром, а не часть продукта.
const HIDE_CSS = `.from-amber-500.to-orange-500 { display: none !important; }`;

// Черновик визарда чека — наша фикстура, а не данные приложения, поэтому
// пишется сразу на языке съёмки: подменять в DOM то, что мы кладём туда сами,
// значило бы городить лишний слой.
const RECEIPT_ITEMS = {
  ru: ["Шашлык из баранины", "Салат «Ачик-чучук»", "Лепёшка тандырная", "Чай зелёный", "Лагман", "Компот"],
  en: ["Lamb kebab", "Achik-chuchuk salad", "Tandyr flatbread", "Green tea", "Lagman", "Compote"],
};
const RECEIPT_PEOPLE = {
  ru: ["Вы", "Ахмед", "Анна", "Коля"],
  en: ["You", "Ahmed", "Anna", "Kolya"],
};
const RECEIPT_TITLE = { ru: "Ужин в Chorsu Grill", en: "Dinner at Chorsu Grill" };

const names = RECEIPT_ITEMS[LANG] ?? RECEIPT_ITEMS.ru;
const people = RECEIPT_PEOPLE[LANG] ?? RECEIPT_PEOPLE.ru;

const RECEIPT_DRAFT = {
  v: 1,
  savedAt: Date.now(),
  step: 2,
  currency: "UZS",
  storeName: "Chorsu Grill",
  ocrTotalAmount: 426000,
  totalAmount: 426000,
  manualMode: false,
  charges: [],
  items: [
    { id: "i1", name: names[0], qty: 4, unitPrice: 48000, ocrTotalPrice: 192000, assignedParticipantIds: [] },
    { id: "i2", name: names[1], qty: 2, unitPrice: 26000, ocrTotalPrice: 52000, assignedParticipantIds: [] },
    { id: "i3", name: names[2], qty: 4, unitPrice: 8000, ocrTotalPrice: 32000, assignedParticipantIds: [] },
    { id: "i4", name: names[3], qty: 2, unitPrice: 12000, ocrTotalPrice: 24000, assignedParticipantIds: [] },
    { id: "i5", name: names[4], qty: 2, unitPrice: 45000, ocrTotalPrice: 90000, assignedParticipantIds: [] },
    { id: "i6", name: names[5], qty: 4, unitPrice: 9000, ocrTotalPrice: 36000, assignedParticipantIds: [] },
  ],
  participants: [
    { id: "p0", name: people[0], isMe: true, color: "#4F46E5", paidById: null },
    { id: "p1", name: people[1], isMe: false, color: "#F59E0B", paidById: null },
    { id: "p2", name: people[2], isMe: false, color: "#A855F7", paidById: null },
    { id: "p3", name: people[3], isMe: false, color: "#059669", paidById: null },
  ],
  payerId: "p0",
  formData: {
    accountId: null,
    categoryId: "",
    description: RECEIPT_TITLE[LANG] ?? RECEIPT_TITLE.ru,
    date: Date.now(),
    createDebts: true,
    currency: "UZS",
  },
};

/**
 * Ставит на страницу подмену текста: разовый проход по дереву плюс наблюдатель
 * за изменениями — Vue перерисовывает узлы, и без наблюдателя перевод держался
 * бы только до первого обновления.
 *
 * Ставится до перехода (`evaluateOnNewDocument`), иначе первый кадр страницы
 * успевает отрисоваться по-русски.
 */
async function installTranslator(target) {
  if (LANG === "ru") return;
  await target.evaluateOnNewDocument((dict) => {
    const rules = dict.rules.map(([from, to]) => [new RegExp(from, "gu"), to]);
    const tr = (s) => {
      const key = s.trim();
      if (!key) return s;
      const hit = dict.exact[key];
      if (hit !== undefined) return s.replace(key, hit);
      let out = s;
      for (const [re, to] of rules) out = out.replace(re, to);
      return out;
    };
    // Правила не идемпотентны: «27 776 253» → «27,776,253», а повторный проход
    // принял бы уже расставленные запятые за десятичные. Запись в nodeValue
    // будит наблюдателя, поэтому свой результат запоминаем и второй раз не
    // трогаем.
    const done = new WeakMap();
    const text = (n) => {
      if (done.get(n) === n.nodeValue) return;
      const v = tr(n.nodeValue);
      done.set(n, v);
      if (v !== n.nodeValue) n.nodeValue = v;
    };
    const attrsDone = new WeakMap();
    const attrs = (el) => {
      for (const name of ["placeholder", "aria-label", "title"]) {
        const v = el.getAttribute?.(name);
        if (!v) continue;
        const seen = attrsDone.get(el) ?? {};
        if (seen[name] === v) continue;
        const next = tr(v);
        attrsDone.set(el, { ...seen, [name]: next });
        if (next !== v) el.setAttribute(name, next);
      }
    };
    const walk = (root) => {
      if (root.nodeType === 3) return text(root);
      if (root.nodeType !== 1) return;
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (it.nextNode()) nodes.push(it.currentNode);
      nodes.forEach(text);
      attrs(root);
      root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach(attrs);
    };
    const start = () => {
      walk(document.body);
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "characterData") text(m.target);
          else if (m.type === "attributes") attrs(m.target);
          else m.addedNodes.forEach(walk);
        }
      }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "aria-label", "title"],
      });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  }, DICT);
}

/**
 * Язык данных: бэкенд выбирает локаль по этому заголовку.
 *
 * Ровно `en`, без региона: AcceptLanguageResolver отдаёт nestjs-i18n самый
 * весомый тег как есть, папки `en-US` в `backend/src/i18n` нет, и запрос
 * молча откатывается на fallback — то есть на русский.
 */
async function setLanguage(target) {
  if (LANG === "ru") return;
  await target.setExtraHTTPHeaders({ "Accept-Language": LANG });
}

// Все видимые строки прогона — сырьё для словаря.
const harvested = new Set();
async function harvest(target) {
  if (!HARVEST) return;
  const found = await target.evaluate(() => {
    const out = new Set();
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (it.nextNode()) {
      const s = (it.currentNode.nodeValue || "").replace(/\s+/g, " ").trim();
      if (s && /[А-Яа-яЁё]/.test(s)) out.add(s);
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label]")) {
      for (const a of ["placeholder", "aria-label"]) {
        const v = el.getAttribute(a);
        if (v && /[А-Яа-яЁё]/.test(v)) out.add(v.trim());
      }
    }
    return [...out];
  });
  found.forEach((s) => harvested.add(s));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  // --lang задаёт navigator.language, а через него и умолчания Intl: без него
  // фронт определил бы локаль как ru и отформатировал даты по-русски.
  args: ["--force-color-profile=srgb", "--hide-scrollbars", ...(LANG === "ru" ? [] : [`--lang=${LANG}-US`])],
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await setLanguage(page);
await installTranslator(page);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Кликает первую кнопку, чей текст содержит подстроку. Бросает, если не нашлась. */
async function clickButton(label) {
  await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
    if (!btn) throw new Error(`Кнопка «${text}» не найдена`);
    btn.click();
  }, label);
}

// Замеры складываем сюда: по экрану — набор именованных рамок в координатах кадра.
const boxes = {};
let currentScreen = null;

/**
 * Меряет элемент на странице и переводит его рамку в координаты кадра.
 *
 * Ищем не по CSS-селектору, а по видимому тексту: классы у Tailwind-разметки
 * меняются от любой правки стилей, а надписи живут дольше. Из совпадений берём
 * самое маленькое — внешние обёртки тоже содержат искомый текст.
 *
 * @param label   имя рамки в отчёте
 * @param opts.text        подстрока видимого текста
 * @param opts.regexSource исходник регулярки вместо подстроки (для дат)
 * @param opts.climb       сколько раз подняться к родителю: подсвечивать надо
 *                         карточку вокруг надписи, а не сам текстовый узел
 * @param opts.index       какое по счёту совпадение брать
 * @param opts.all         вернуть все совпадения (сверху вниз) массивом
 * @param opts.pad         расширить рамку на N кадровых пикселей во все стороны
 */
async function measure(label, opts) {
  const rects = await page.evaluate((o) => {
    const re = o.regexSource ? new RegExp(o.regexSource) : null;
    const visible = [...document.querySelectorAll(o.selector || "body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      // Суммы вёрстаны через неразрывные пробелы, поэтому «120 000» с обычным
      // пробелом мимо. Сводим любые пробелы к одному до сравнения.
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!t) return false;
      return re ? re.test(t) : t.includes(o.text);
    });
    // Оставляем самые внутренние совпадения: если предок и потомок оба
    // содержат текст, нужен потомок.
    const inner = visible.filter((el) => !visible.some((other) => other !== el && el.contains(other)));
    const climbed = inner.map((el) => {
      let node = el;
      for (let i = 0; i < (o.climb || 0) && node.parentElement; i++) node = node.parentElement;
      if (o.pick) node = node.querySelector(o.pick) || node;
      return node;
    });
    const uniq = [...new Set(climbed)];
    uniq.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    // union — одна рамка вокруг всех совпадений: так меряется ряд чипов,
    // у которых нет общего контейнера.
    if (o.union) {
      if (!uniq.length) return [null];
      const rs = uniq.map(rect);
      const x = Math.min(...rs.map((r) => r.x));
      const y = Math.min(...rs.map((r) => r.y));
      return [{ x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }];
    }
    const picked = o.all ? uniq : [uniq[o.index || 0]];
    return picked.map((el) => (el ? rect(el) : null));
  }, opts);

  if (rects.some((r) => r === null)) {
    throw new Error(`Замер «${label}»: элемент не найден на ${page.url()}`);
  }

  const pad = opts.pad || 0;
  const toFrame = (r) => ({
    left: Math.round(OX + r.x * K) - pad,
    top: Math.round(OY + r.y * K) - pad,
    width: Math.round(r.w * K) + pad * 2,
    height: Math.round(r.h * K) + pad * 2,
  });

  const value = opts.all ? rects.map(toFrame) : toFrame(rects[0]);
  boxes[currentScreen] = boxes[currentScreen] || {};
  boxes[currentScreen][label] = value;
  return value;
}

await mkdir(OUT, { recursive: true });

/**
 * Прячет служебный хром и убеждается, что он действительно исчез.
 *
 * Кнопка Vue DevTools живёт в кастомном элементе прямо в body и CSS-правилом
 * не гасится — её приходится удалять из дерева. На проде её не было, на
 * локальном стенде она попадает в кадр по центру снизу.
 */
async function cleanChrome(target) {
  await target.addStyleTag({ content: HIDE_CSS });
  await target.evaluate(() => {
    for (const el of document.querySelectorAll("body > *")) {
      const id = (el.id || "").toLowerCase();
      const tag = el.tagName.toLowerCase();
      if (id.includes("devtools") || tag.includes("devtools")) el.remove();
    }
  });
  const leaked = await target.evaluate(() => /(?:Демо|Demo):\s*\d/.test(document.body.innerText));
  if (leaked) throw new Error("Плашка демо-режима осталась в кадре — селектор HIDE_CSS больше не совпадает");
}

async function shoot(file, waitText) {
  if (page.url().includes("/auth") || page.url().includes("/onboarding")) {
    throw new Error(`Выбросило на ${page.url()} при съёмке ${file}`);
  }
  if (waitText) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 30000 }, waitText);
  }
  // Дать доехать входным анимациям приложения перед съёмкой.
  await sleep(1500);
  await cleanChrome(page);
  await harvest(page);
  await page.screenshot({ path: new URL(file, OUT).pathname });
  currentScreen = file.replace(".png", "");
  console.log(`✓ ${file}`);
}

/**
 * @param scroll  на сколько CSS-пикселей прокрутить перед съёмкой. Нужен там,
 *                где интересное лежит ниже первого экрана: замеры берутся из
 *                живого DOM и после прокрутки совпадают с картинкой, а без неё
 *                указывали бы на область, которой в скриншоте нет.
 */
async function shootPage(path, file, waitText, scroll = 0) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  if (scroll) {
    await page.evaluate((y) => {
      const scroller = [...document.querySelectorAll("*")].find((el) => el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY !== "visible");
      (scroller ?? window).scrollBy({ top: y, behavior: "instant" });
    }, scroll);
    await sleep(600);
  }
  await shoot(file, waitText);
}

// Первый заход на /auth/login гвард уводит на /welcome, пока не выставлен
// hasSeenOnboarding. Открываем origin, гасим онбординг, только потом логинимся.
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate(
  (version, lang) => {
  localStorage.setItem("locale", lang);
  localStorage.setItem("hasSeenOnboarding", "true");
  localStorage.setItem("theme", "dark");
  localStorage.setItem("push-banner-dismissed", "true");
  localStorage.setItem("pwa-install-dismissed", "true");
  localStorage.setItem("lastSeenChangelogVersion", version);
  },
  CURRENT_VERSION,
  LANG,
);

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle2" });
await clickButton(t("Попробовать демо"));

// Ждём настоящего признака успеха — появления токена. Проверка по пути
// обманчива: на /welcome она истинна ещё до того, как демо-юзер создан.
await page.waitForFunction(() => Boolean(localStorage.getItem("access_token")), { timeout: 60000 });

// Демо-юзер приходит с сидовыми счетами, но клиентский флаг онбординга не
// выставлен — без него роутер уводит любую страницу на /onboarding/first-account.
await page.evaluate((draft) => {
  localStorage.setItem("onboardingComplete", "true");
  localStorage.setItem("scan-receipt:draft", JSON.stringify(draft));
}, RECEIPT_DRAFT);

// Сид дописывает то, чего у демо-юзера нет: валютный счёт, подписки, бюджет и
// инбокс Telegram-импорта. Пользователь берётся из токена этой же сессии.
const session = await page.evaluate(() => {
  const token = localStorage.getItem("access_token");
  const [, payload] = token.split(".");
  const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  return { token, userId: json.sub };
});
console.log("→ сид");
execFileSync("bun", [SEED, "--token", session.token, "--user", session.userId, "--lang", LANG], { stdio: "inherit" });

/** Кликает самый внутренний элемент, чей текст содержит подстроку. */
async function clickText(text) {
  await page.evaluate((t) => {
    const hits = [...document.querySelectorAll("body *")].filter((e) => e.textContent?.includes(t));
    const inner = hits.filter((e) => !hits.some((o) => o !== e && e.contains(o)));
    const target = inner[0];
    if (!target) throw new Error(`Элемент с текстом «${t}» не найден`);
    (target.closest("button, a, [role=button]") ?? target).click();
  }, text);
}

// Инбокс импорта: три операции, разобранные настоящим парсером из настоящих
// текстов уведомлений банка. У прод-демо этот экран пуст — ради него и поднят
// локальный стенд.
await shootPage("/import-inbox", "inbox.png", t("На подтверждение"));
await measure("card1", { text: "KORZINKA", climb: 2, pad: 6 });
await measure("card2", { text: "YandexGO", climb: 2, pad: 6 });
await measure("card3", { text: "CAFE BON", climb: 2, pad: 6 });
// Инбокс показывает свежее сверху, а сид кладёт сообщения по порядку — номер
// карточки должен значить «первая сверху», иначе подсветка поедет по кадру
// снизу вверх.
[...[boxes.inbox.card1, boxes.inbox.card2, boxes.inbox.card3]].sort((a, b) => a.top - b.top).forEach((b, i) => (boxes.inbox[`card${i + 1}`] = b));

// Экран подтверждения: здесь видно, что счёт и категория подставлены сами,
// а человеку остаётся тап. Заходим кликом по карточке, а не по угаданному
// адресу: маршрут содержит id импорта, который у каждого прогона свой.
await clickText("KORZINKA");
await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 30000 }, t("Категория"));
await shoot("confirm.png");
await measure("confirmAmount", { text: "KORZINKA", climb: 2, pad: 6 });
await measure("confirmCategory", { text: t("Категория"), climb: 1, pad: 6 });

await shootPage("/debts", "debts.png", t("Долги"));
await measure("net", { text: t("ИТОГ ПО ВСЕМ"), climb: 1, pad: 6 });
await measure("rowAhmed", { text: t("Ахмед"), climb: 2, pad: 4 });
await measure("rowDima", { text: t("Дима"), climb: 2, pad: 4 });

// Без прокрутки кольцо категорий стоит у самого низа экрана и наполовину уходит
// под плавающую нижнюю навигацию. Прокрутка на 300 px поднимает в один кадр
// график темпа расходов, кольцо и начало списка категорий — три такта сцены.
await shootPage("/analytics", "analytics.png", t("Аналитика"), 300);
await measure("pace", { text: t("Темп расходов"), climb: 2, pad: 6 });
await measure("donut", { text: t("Всего"), climb: 2 });
await measure("topCategory", { text: t("Продукты"), climb: 1, pad: 4 });

await shootPage("/", "home.png", t("БАЛАНС"));
await measure("balanceCard", { text: t("БЕЗОПАСНО"), climb: 3, pad: 4 });
await measure("dailyBudget", { text: t("БЕЗОПАСНО"), climb: 2, pad: 4 });

await shootPage("/history", "history.png", t("История"));
// Даты ищем регуляркой: они меняются каждый день, подстрока «7 августа» жила бы сутки.
await measure("dayRulers", { regexSource: LANG === "ru" ? "^\\d{1,2}\\s[а-яё]+$" : "^[A-Za-z]+\\s\\d{1,2}$", climb: 1, all: true, pad: 4 });
await measure("filters", { text: t("Переводы"), climb: 1, pad: 4 });

// Пустая форма с «0 сўм» читается как «ничего не ввели». Поле суммы
// автофокусится при открытии, поэтому сумму просто печатаем, а категорию
// выбираем тапом — ровно то, что сцена и обещает.
await page.goto(`${BASE}/transactions/new`, { waitUntil: "networkidle2" });
await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 30000 }, t("Категория"));
await page.keyboard.type("450000", { delay: 40 });
await clickButton(t("Кафе"));
// Разряды отбиты по-разному: пробел в русской раскладке, запятая в английской.
await page.waitForFunction(() => /450[\s,]?000/.test(document.body.innerText), { timeout: 15000 });
await shoot("add.png");
await measure("amount", { text: t("Останется"), climb: 2, pad: 6 });
// Чипов частых сумм тут намеренно нет: они считаются из истории и у части
// демо-сидов не появляются вовсе — такт на исчезающем элементе не строим.
await measure("categoryChip", { text: t("Кафе"), pad: 4 });
await measure("splitAndScan", { text: t("Скан чека"), climb: 2, pad: 6 });

// Визард открывается на шаге 1 с баннером «Продолжить прошлый чек?».
// Восстановление черновика даёт настоящий экран позиций — без фейкового
// фото чека и без обращения к распознаванию.
await page.goto(`${BASE}/scan-receipt`, { waitUntil: "networkidle2" });
await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 30000 }, t("Продолжить"));
await clickButton(t("Продолжить"));
await shoot("scan.png", names[0]);
// По названиям позиций, а не по «UZS»: подстрока валюты ловит и строку
// «сколько с человека», и набор совпадений разъезжается между языками.
for (const [i, name] of names.entries()) await measure(`itemRow${i + 1}`, { text: name, climb: 2, pad: 4 });
await measure("total", { text: t("Итого"), climb: 1, pad: 6 });

// Шаг 3 — участники. Сразу делим поровну: иначе экран показывает
// «НАЗНАЧЕНО 0 ИЗ 6», то есть ровно то, чего в промо быть не должно.
await clickButton(t("Далее — Участники"));
await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 30000 }, t("Поровну на всех"));
await clickButton(t("Поровну на всех"));
const ASSIGNED_ALL = t("НАЗНАЧЕНО 6 ИЗ 6");
await page.waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 30000 }, ASSIGNED_ALL);
await shoot("split.png", ASSIGNED_ALL);
await measure("progress", { text: t("НАЗНАЧЕНО"), climb: 2, pad: 6 });
await measure("participants", { text: t("На всех"), climb: 1, pad: 4 });
await measure("itemRow1", { text: names[0], climb: 3, pad: 4 });
await measure("itemRow2", { text: names[1], climb: 3, pad: 4 });
await measure("itemRow3", { text: names[2], climb: 3, pad: 4 });

// Десктопный кадр — единственный, снятый не телефоном. Отдельная вкладка, а не
// смена вьюпорта: приложение перезагружает себя при пересечении порога 1024, и
// эмуляция телефона (isMobile/hasTouch) должна быть выключена целиком.
// 1280×720 при DPR 3 даёт 3840×2160; в кадре 1920×1080 это масштаб 0.5, то
// есть текст интерфейса 14 px читается как 21 px.
const desktop = await browser.newPage();
await setLanguage(desktop);
await installTranslator(desktop);
await desktop.setViewport({ width: 1280, height: 720, deviceScaleFactor: 3, isMobile: false, hasTouch: false });
await desktop.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await desktop.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await desktop.waitForFunction((a, b) => document.body.innerText.includes(a) || document.body.innerText.includes(b), { timeout: 30000 }, t("Баланс"), t("БАЛАНС"));
const hasSidebar = await desktop.evaluate(
  () => Boolean(document.querySelector("aside, nav[class*=sidebar], [class*=SidebarNav]")) || window.innerWidth >= 1024,
);
if (!hasSidebar) throw new Error("Десктопная вёрстка не включилась — порог 1024 не пройден");
await new Promise((r) => setTimeout(r, 1500));
await cleanChrome(desktop);
await harvest(desktop);
await desktop.screenshot({ path: new URL("desktop.png", OUT).pathname });
console.log("✓ desktop.png");

await browser.close();

await writeFile(new URL("boxes.json", OUT), JSON.stringify(boxes, null, 2));

if (HARVEST) {
  const list = [...harvested].sort((a, b) => a.localeCompare(b, "ru"));
  await writeFile(new URL("./harvest.json", import.meta.url), JSON.stringify(list, null, 2));
  console.log(`\n✓ собрано ${list.length} русских строк → scripts/harvest.json`);
}

console.log("\nРамки в пикселях источника (вставлять в сцены как литералы),");
console.log("в скобках — loupeTop, при котором элемент оказывается в середине лупы:\n");
for (const [screen, named] of Object.entries(boxes)) {
  console.log(`  ${screen}`);
  for (const [label, box] of Object.entries(named)) {
    const list = Array.isArray(box) ? box : [box];
    list.forEach((b, i) => {
      const suffix = Array.isArray(box) ? `[${i}]` : "";
      console.log(
        `    ${(label + suffix).padEnd(18)} left ${String(b.left).padStart(4)}  top ${String(b.top).padStart(4)}  w ${String(b.width).padStart(4)}  h ${String(b.height).padStart(4)}   loupeTop ${loupeTopFor(b)}`,
      );
    });
  }
}
