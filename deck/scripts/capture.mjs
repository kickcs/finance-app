// Снимает реальные экраны прод-демо в СВЕТЛОЙ теме для инвесторской презентации.
// Родня promo/scripts/capture.mjs, но без замеров рамок: в PDF нет оверлеев,
// зато нужен десктопный экран и светлая тема вместо тёмной.
//
// Каждый экран снимается дважды: как есть → public/shots/, и с подменённым на
// английский текстом → public/shots/en/. Оба кадра берутся из одной сессии, то
// есть у одного демо-юзера: иначе цифры в русском и английском деке разойдутся.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { DICT, RULES } from "./shots-en.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://app.ouro-finance.top";
const OUT = new URL("../public/shots/", import.meta.url);
const CHANGELOG = new URL("../../frontend/src/features/changelog/model/changelogData.ts", import.meta.url);

// Модалка «Что нового» показывается, пока сохранённая версия !== текущей.
const changelogSrc = await readFile(CHANGELOG, "utf8");
const CURRENT_VERSION = changelogSrc.match(/CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
if (!CURRENT_VERSION) throw new Error("Не удалось прочитать CURRENT_VERSION из changelogData.ts");

// Плашка демо-режима с таймером — служебный хром, а не часть продукта.
const HIDE_CSS = `.from-amber-500.to-orange-500 { display: none !important; }`;

// Нижняя навигация плавает над содержимым и срезает последние строки списков;
// в деке важнее экран. Второй селектор — обёртка «жидкого стекла», внутри неё
// лежит тот же <nav>. Только для телефона: на десктопе <nav> — это боковое
// меню, и без него страница выглядит сломанной, а не чистой.
const HIDE_NAV_CSS = `nav, div.fixed.bottom-4 { display: none !important; }`;
let hideNav = true;

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
    { id: "i1", name: "Шашлык из баранины", qty: 4, unitPrice: 48000, ocrTotalPrice: 192000, assignedParticipantIds: [] },
    { id: "i2", name: "Салат «Ачик-чучук»", qty: 2, unitPrice: 26000, ocrTotalPrice: 52000, assignedParticipantIds: [] },
    { id: "i3", name: "Лепёшка тандырная", qty: 4, unitPrice: 8000, ocrTotalPrice: 32000, assignedParticipantIds: [] },
    { id: "i4", name: "Чай зелёный", qty: 2, unitPrice: 12000, ocrTotalPrice: 24000, assignedParticipantIds: [] },
    { id: "i5", name: "Лагман", qty: 2, unitPrice: 45000, ocrTotalPrice: 90000, assignedParticipantIds: [] },
    { id: "i6", name: "Компот", qty: 4, unitPrice: 9000, ocrTotalPrice: 36000, assignedParticipantIds: [] },
  ],
  participants: [
    { id: "p0", name: "Вы", isMe: true, color: "#4F46E5", paidById: null },
    { id: "p1", name: "Ахмед", isMe: false, color: "#F59E0B", paidById: null },
    { id: "p2", name: "Анна", isMe: false, color: "#A855F7", paidById: null },
    { id: "p3", name: "Коля", isMe: false, color: "#059669", paidById: null },
  ],
  payerId: "p0",
  formData: {
    accountId: null,
    categoryId: "",
    description: "Ужин в Chorsu Grill",
    date: Date.now(),
    createDebts: true,
    currency: "UZS",
  },
};

// Плотность снимается ровно вдвое от размера в деке (телефон 384 px, десктоп
// 700 px): Chrome вшивает в PDF растр целиком, поэтому лишние пиксели — это
// лишние мегабайты в файле, а не резкость на экране.
const PHONE = { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1512, height: 945, deviceScaleFactor: 1, isMobile: false, hasTouch: false };

// Резолвер в некоторых окружениях не знает домен прода. OURO_HOST_IP=<ip>
// прокидывает адрес мимо DNS; без переменной ничего не меняется.
const HOST_IP = process.env.OURO_HOST_IP;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: PHONE,
  args: [
    "--force-color-profile=srgb",
    "--hide-scrollbars",
    ...(HOST_IP ? [`--host-resolver-rules=MAP ${new URL(BASE).hostname} ${HOST_IP}`] : []),
  ],
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Кликает первую кнопку, чей текст содержит подстроку. Бросает, если не нашлась. */
async function clickButton(label) {
  await page.evaluate((text) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
    if (!btn) throw new Error(`Кнопка «${text}» не найдена`);
    btn.click();
  }, label);
}

await mkdir(OUT, { recursive: true });
await mkdir(new URL("en/", OUT), { recursive: true });

const untranslated = new Set();

/**
 * Подменяет русский текст английским прямо в DOM и оставляет на window
 * функцию отката: съёмка продолжается по русскому интерфейсу, кнопки в
 * сценарии ищутся по русским подписям.
 * Возвращает строки, для которых не нашлось ни словаря, ни правила.
 */
function applyEn(dict, rules) {
  const CYR = /[\u0400-\u04FF]/;
  const stash = [];
  const missed = [];

  const conv = (raw) => {
    const key = raw.trim();
    if (!key) return null;
    let out = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    for (const [pattern, to] of rules) out = out.replace(new RegExp(pattern, "gu"), to);
    if (CYR.test(out)) missed.push(key);
    return out === key ? null : raw.replace(key, out);
  };

  const shown = (el) => el?.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? false;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (!CYR.test(n.nodeValue) || !shown(n.parentElement)) continue;
    const next = conv(n.nodeValue);
    if (next === null) continue;
    stash.push([n, "nodeValue", n.nodeValue]);
    n.nodeValue = next;
  }

  // Только placeholder: aria-label и title в кадр не попадают, а в список
  // непереведённого добавляли бы сотню строк, которых никто не увидит.
  for (const el of document.querySelectorAll("[placeholder]")) {
    if (!shown(el)) continue;
    const value = el.getAttribute("placeholder");
    if (!value || !CYR.test(value)) continue;
    const next = conv(value);
    if (next === null) continue;
    stash.push([el, "placeholder", value]);
    el.setAttribute("placeholder", next);
  }

  window.__restoreEn = () => {
    for (const [target, key, value] of stash) {
      if (key === "nodeValue") target.nodeValue = value;
      else target.setAttribute(key, value);
    }
    delete window.__restoreEn;
  };
  return [...new Set(missed)];
}

/** Прячет служебный хром и убеждается, что он действительно исчез. */
async function hideChrome() {
  await page.addStyleTag({ content: hideNav ? `${HIDE_CSS}\n${HIDE_NAV_CSS}` : HIDE_CSS });
  const leaked = await page.evaluate(() => /Демо:\s*\d/.test(document.body.innerText));
  if (leaked) throw new Error("Плашка демо-режима осталась в кадре — селектор HIDE_CSS больше не совпадает");
}

async function shoot(file, waitText) {
  if (page.url().includes("/auth") || page.url().includes("/onboarding")) {
    throw new Error(`Выбросило на ${page.url()} при съёмке ${file}`);
  }
  if (waitText) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 30000 }, waitText);
  }
  // Светлая тема применяется классом на <html>; если её не случилось, весь
  // смысл прогона теряется — лучше упасть, чем отдать тёмные кадры.
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if (isDark) throw new Error(`Тёмная тема осталась включённой при съёмке ${file}`);
  // Дать доехать входным анимациям приложения перед съёмкой.
  await sleep(1500);
  await hideChrome();
  await page.screenshot({ path: new URL(file, OUT).pathname });

  const missed = await page.evaluate(applyEn, DICT, RULES);
  await page.screenshot({ path: new URL(`en/${file}`, OUT).pathname });
  await page.evaluate(() => window.__restoreEn?.());
  missed.forEach((m) => untranslated.add(m));

  console.log(`✓ ${file}${missed.length ? `  (${missed.length} строк без перевода)` : ""}`);
}

async function shootPage(path, file, waitText) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
  await shoot(file, waitText);
}

// Первый заход на /auth/login гвард уводит на /welcome, пока не выставлен
// hasSeenOnboarding. Открываем origin, гасим онбординг, только потом логинимся.
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate((version) => {
  localStorage.setItem("hasSeenOnboarding", "true");
  localStorage.setItem("theme", "light");
  localStorage.setItem("push-banner-dismissed", "true");
  localStorage.setItem("pwa-install-dismissed", "true");
  localStorage.setItem("lastSeenChangelogVersion", version);
}, CURRENT_VERSION);

await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle2" });
await clickButton("Попробовать демо");

// Ждём настоящего признака успеха — появления токена. Проверка по пути
// обманчива: на /welcome она истинна ещё до того, как демо-юзер создан.
await page.waitForFunction(() => Boolean(localStorage.getItem("access_token")), { timeout: 60000 });

// Демо-юзер приходит с сидовыми счетами, но клиентский флаг онбординга не
// выставлен — без него роутер уводит любую страницу на /onboarding/first-account.
await page.evaluate((draft) => {
  localStorage.setItem("onboardingComplete", "true");
  localStorage.setItem("scan-receipt:draft", JSON.stringify(draft));
}, RECEIPT_DRAFT);

await shootPage("/", "home.png", "БАЛАНС");

// Демо-юзер создаётся заново на каждом прогоне, и суммы у него другие. Слайд
// «каждый день» повторяет три цифры дашборда крупно — печатаем их, иначе после
// пересъёмки текст слайда молча разойдётся с картинкой рядом.
const daily = await page.evaluate(() => {
  const cell = (label) =>
    [...document.querySelectorAll("div")]
      .filter((d) => d.innerText?.startsWith(label) && d.innerText.length < 40)
      .map((d) => d.innerText.replace(label, "").trim())[0] ?? "?";
  return { "расход/дн": cell("РАСХОД/ДН"), безопасно: cell("БЕЗОПАСНО"), осталось: cell("ОСТАЛОСЬ") };
});
await shootPage("/debts", "debts.png", "Долги");
await shootPage("/analytics", "analytics.png", "Аналитика");
// Экрана «подключить Telegram-бота» в приложении нет: /settings/import — это
// CSV-импорт, где две карточки из трёх помечены «Скоро». Слайд про Telegram
// поэтому строится схемой потока, а не кадром. Снимать нечего.

// Пустая форма с «0 сўм» читается как «ничего не ввели». Поле суммы
// автофокусится при открытии, поэтому сумму печатаем, а категорию тапаем.
await page.goto(`${BASE}/transactions/new`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Категория"), { timeout: 30000 });
await page.keyboard.type("450000", { delay: 40 });
await clickButton("Кафе");
await page.waitForFunction(() => /450\s?000/.test(document.body.innerText), { timeout: 15000 });
await shoot("add.png");

// Визард открывается на шаге 1 с баннером «Продолжить прошлый чек?».
// Восстановление черновика даёт настоящий экран позиций — без фейкового
// фото чека и без обращения к распознаванию.
await page.goto(`${BASE}/scan-receipt`, { waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Продолжить"), { timeout: 30000 });
await clickButton("Продолжить");
await shoot("scan.png", "Шашлык");

// Шаг 3 — участники. Сразу делим поровну: иначе экран показывает
// «НАЗНАЧЕНО 0 ИЗ 6», то есть что ничего ещё не разделено.
await clickButton("Далее — Участники");
await page.waitForFunction(() => document.body.innerText.includes("Поровну на всех"), { timeout: 30000 });
await clickButton("Поровну на всех");
await shoot("split.png", "НАЗНАЧЕНО 6 ИЗ 6");

// Десктопная веб-версия: у дашборда есть собственный макет (platformPage),
// порог платформы — 1024 px, поэтому вьюпорт меняем и перезагружаем страницу.
hideNav = false;
await page.setViewport(DESKTOP);
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await shoot("desktop-home.png", "БАЛАНС");

await browser.close();

// PNG-скриншоты Chrome укладывает в PDF несжатым растром — дек весил 18 МБ.
// JPEG попадает в PDF как есть (DCTDecode), поэтому конвертируем: на кадрах
// интерфейса, показанных вдвое мельче съёмки, потери не видны.
let jpegs = 0;
for (const dir of [OUT, new URL("en/", OUT)]) {
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".png")) continue;
    const src = new URL(file, dir).pathname;
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "88", src, "--out", src.replace(/\.png$/, ".jpg")], {
      stdio: "ignore",
    });
    jpegs += 1;
  }
}
console.log(`\nГотово. ${jpegs} кадров в deck/public/shots/ и shots/en/ (png — исходники, jpg — для дека)`);
console.log("\nЦифры дашборда этой сессии — сверьте блок .metrics на слайде 9 обоих деков:");
for (const [k, v] of Object.entries(daily)) console.log(`  ${k.padEnd(11)} ${v}`);

// Русское слово, оставшееся в английском кадре, в деке никто не заметит до
// показа инвестору. Поэтому непереведённое роняет прогон — со списком, который
// надо разложить по scripts/shots-en.mjs.
if (untranslated.size) {
  const list = [...untranslated].sort();
  console.log(`\nБез перевода (${list.length}) — добавьте в scripts/shots-en.mjs:`);
  for (const key of list) console.log(`  ${JSON.stringify(key)}: "",`);
  throw new Error(`Английские кадры сняты, но ${list.length} строк остались русскими`);
}
