/**
 * Промо-сид: готовит локальный инстанс к съёмке.
 *
 * Базу данных сеет само приложение — демо-режим создаёт счета, операции, долги
 * и людей. Скрипт лишь дописывает то, чего у демо-юзера нет, а в ролике должно
 * быть: валютный счёт, подписки, месячный бюджет и инбокс Telegram-импорта.
 *
 * Инбокс наполняется настоящим парсером `HumoMessageParser` — тем же классом,
 * который работает в бою, — но запись кладётся в таблицу напрямую, минуя
 * grammY. Причина: `bot.init()` ходит в Telegram за `getMe`, и без валидного
 * токена модуль выключается, а вебхук отвечает 503. Тянуть продовый токен на
 * машину разработчика нельзя: `onApplicationBootstrap` тем же заходом
 * переписал бы кнопку меню живого бота. Транспорт — единственное, что здесь
 * подменено; разбор суммы, магазина, карты и даты настоящий.
 *
 * Запускается через bun: скрипт импортирует парсер прямо из исходников
 * бэкенда, а bun читает TypeScript без сборки.
 *
 *   cd promo && npm run seed
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { HumoMessageParser } from "../../backend/src/modules/telegram-import/domain/parsers/humo-message.parser.ts";
import { computeDedupHash } from "../../backend/src/modules/telegram-import/domain/parsers/dedup-hash.ts";

const API = process.env.PROMO_API ?? "http://localhost:3000/api";
const DB_CONTAINER = process.env.PROMO_DB_CONTAINER ?? "finance-postgres";
const DB_NAME = process.env.PROMO_DB_NAME ?? "my_finance";
const DB_USER = process.env.PROMO_DB_USER ?? "postgres";

/** Синтетический Telegram-пользователь: связка нужна инбоксу, а переписки нет. */
/** Язык данных сида. Совпадает с языком съёмки: capture передаёт его сюда. */
const LANG = process.argv[process.argv.indexOf("--lang") + 1] ?? "ru";
const pick = (dict) => dict[LANG] ?? dict.ru;

const TELEGRAM_USER_ID = 770077007;

/**
 * Уведомления в формате HUMO. Формат взят из тестов парсера
 * (`humo-message.parser.spec.ts`) — это настоящие сообщения банка, а не макет.
 */
const BANK_MESSAGES = [
  `💸 Оплата
➖ 42.000,00 UZS
📍 KORZINKA CHILANZAR
💳 HUMOCARD *1951
🕓 09:14 {DATE}
💰 3.148.220,00 UZS`,
  `💸 Оплата
➖ 18.000,00 UZS
📍 YandexGO Taxi UB OPL
💳 HUMOCARD *1951
🕓 12:41 {DATE}
💰 3.130.220,00 UZS`,
  `💸 Оплата
➖ 96.500,00 UZS
📍 CAFE BON EATERY
💳 HUMOCARD *1951
🕓 19:05 {DATE}
💰 3.033.720,00 UZS`,
];

let token = null;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

/** Литерал строки для psql: экранируется только кавычка, переводы строк допустимы как есть. */
/**
 * Переводит демо-данные, уже созданные приложением.
 *
 * Анонимный вход не принимает язык, а `DemoInitializationService` берёт его из
 * профиля — то есть демо-юзер всегда рождается русским. Переписать данные
 * после создания дешевле, чем менять продуктовый код ради съёмки.
 *
 * Пары берутся из тех же файлов, по которым переводит сам бэкенд
 * (`backend/src/i18n/{ru,en}/*.json`), поэтому в кадр попадают его формулировки,
 * а не сочинённые здесь.
 */
function localizeDemoData(userId) {
  const load = (lang, file) => JSON.parse(readFileSync(new URL(`../../backend/src/i18n/${lang}/${file}.json`, import.meta.url), "utf8"));

  /** Пары ru→en для поддерева: строки по ключу, элементы массивов по индексу. */
  const pairs = (ru, en, out = []) => {
    for (const [key, value] of Object.entries(ru)) {
      const other = en?.[key];
      if (other === undefined) continue;
      if (typeof value === "string") out.push([value, other]);
      else if (Array.isArray(value)) value.forEach((v, i) => other[i] && out.push([v, other[i]]));
      else pairs(value, other, out);
    }
    return out;
  };

  const demoRu = load("ru", "demo");
  const demoEn = load(LANG, "demo");
  const catRu = load("ru", "categories");
  const catEn = load(LANG, "categories");

  const update = (table, column, list) =>
    list
      .filter(([from, to]) => from !== to)
      .map(([from, to]) => `UPDATE ${table} SET ${column} = ${q(to)} WHERE user_id = ${q(userId)} AND ${column} = ${q(from)};`)
      .join("\n");

  const contacts = pairs(demoRu.contacts, demoEn.contacts);
  const descriptions = [...pairs(demoRu.descriptions, demoEn.descriptions), ...pairs(demoRu.debts, demoEn.debts)];

  runSql(
    [
      "BEGIN;",
      update("categories", "name", pairs(catRu, catEn)),
      update("accounts", "name", pairs(demoRu.accounts, demoEn.accounts)),
      update("people", "name", contacts),
      update("debts", "person_name", contacts),
      update("debts", "description", pairs(demoRu.debts, demoEn.debts)),
      update("transactions", "description", descriptions),
      "COMMIT;",
    ].join("\n"),
  );
}

const q = (value) => (value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);
const num = (value) => (value === null || value === undefined ? "NULL" : String(value));

function runSql(sql) {
  return execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-f", "/dev/stdin"], {
    input: sql,
    encoding: "utf8",
  });
}

function ddmmyyyy(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/** Дата через N дней от сегодня, в ISO — для дат следующего списания подписок. */
function inDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Готовую сессию передаёт `capture.mjs`: он логинится демо-кнопкой в браузере и
 * отдаёт сюда свежий токен. Так съёмка и обогащение работают с одним и тем же
 * пользователем — токен живёт 15 минут, а refresh лежит в httpOnly-куке,
 * которой у скрипта нет.
 */
function sessionFromArgs() {
  const at = process.argv.indexOf("--token");
  const uid = process.argv.indexOf("--user");
  if (at === -1 || uid === -1) return null;
  return { accessToken: process.argv[at + 1], userId: process.argv[uid + 1] };
}

async function main() {
  let session = sessionFromArgs();
  if (session) {
    console.log("→ сессия получена от capture.mjs");
  } else {
    console.log("→ демо-пользователь");
    const auth = await api("POST", "/auth/login/anonymous", {});
    session = { accessToken: auth.accessToken, userId: auth.user.id };
  }
  token = session.accessToken;
  const userId = session.userId;
  console.log(`  userId = ${userId}`);

  const accounts = await api("GET", "/accounts");
  console.log(`  демо-сид дал счетов: ${accounts.length}`);

  console.log("→ валютный счёт");
  await api("POST", "/accounts", {
    name: pick({ ru: "Доллары", en: "Dollars" }),
    icon: "savings",
    color: "#E8C865",
    type: "savings",
    balances: [{ currency: "USD", balance: 1250 }],
  });

  console.log("→ подписки");
  const mainAccountId = accounts[0]?.id;
  // categoryId в DTO необязателен, но колонка в базе по умолчанию хранит слаг
  // `entertainment`, а чтение подписки джойнит категории по uuid — и падает.
  // Поэтому категорию передаём явно, настоящую.
  let categories = await api("GET", "/categories");
  if (!Array.isArray(categories) || categories.length === 0) {
    await api("POST", "/categories/initialize-defaults", {});
    categories = await api("GET", "/categories");
  }
  const expenseCategoryId = categories.find((c) => c.type === "expense")?.id;
  if (!expenseCategoryId) throw new Error(`Нет ни одной категории расхода: ${JSON.stringify(categories).slice(0, 200)}`);
  console.log(`  категорий: ${categories.length}`);
  // Иконки — ключи из `frontend/src/shared/ui/icon/iconMap.ts`; чего нет в
  // карте, то отрисуется заглушкой и попадёт в кадр дефектом.
  const subscriptions = [
    { name: pick({ ru: "Яндекс Плюс", en: "Yandex Plus" }), amount: 39000, currency: "UZS", icon: "play_arrow", color: "#E8C865", frequency: "monthly", billingDate: inDays(6) },
    { name: "Spotify", amount: 4.99, currency: "USD", icon: "music_note", color: "#4ADE80", frequency: "monthly", billingDate: inDays(13) },
    { name: pick({ ru: "Интернет дома", en: "Home internet" }), amount: 180000, currency: "UZS", icon: "wifi", color: "#818CF8", frequency: "monthly", billingDate: inDays(21) },
  ];
  for (const s of subscriptions) {
    await api("POST", "/recurring-subscriptions", { ...s, accountId: mainAccountId, categoryId: expenseCategoryId });
  }

  console.log("→ месячный бюджет");
  await api("PUT", "/budgets/default", { amount: 9000000 });

  if (LANG !== "ru") {
    console.log(`→ демо-данные на «${LANG}»`);
    localizeDemoData(userId);
    await api("PATCH", "/profiles/me", { language: LANG });
  }

  console.log("→ Telegram-связка и инбокс импорта");
  const parser = new HumoMessageParser();
  const today = ddmmyyyy(new Date());
  const rows = [];
  for (const template of BANK_MESSAGES) {
    const raw = template.replace("{DATE}", today);
    const parsed = parser.parse(raw);
    if (!parsed) throw new Error(`Парсер не разобрал сообщение:\n${raw}`);
    rows.push({ raw, parsed, hash: computeDedupHash(parsed) });
  }

  const values = rows
    .map(
      ({ raw, parsed, hash }) =>
        `(${q(userId)}, ${q(raw)}, ${q(parsed.type)}, ${num(parsed.amount)}, ${q(parsed.currency)}, ` +
        `${q(parsed.merchant)}, ${q(parsed.cardMask)}, ${q(parsed.occurredAt.toISOString())}, ` +
        `${num(parsed.balanceAfter)}, ${q(hash)}, 'pending')`,
    )
    .join(",\n    ");

  runSql(`
BEGIN;
DELETE FROM telegram_links WHERE telegram_user_id = ${TELEGRAM_USER_ID};
INSERT INTO telegram_links (user_id, telegram_user_id, telegram_username)
  VALUES (${q(userId)}, ${TELEGRAM_USER_ID}, 'promo');
INSERT INTO imported_transactions
  (user_id, raw_text, type, amount, currency, merchant, card_mask, occurred_at, balance_after, dedup_hash, status)
  VALUES
    ${values}
  ON CONFLICT (user_id, dedup_hash) DO NOTHING;
COMMIT;
`);

  const pending = runSql(`SELECT count(*) FROM imported_transactions WHERE user_id = ${q(userId)} AND status = 'pending';`);

  console.log("\nГотово.");
  console.log(`  счетов:        ${accounts.length + 1}`);
  console.log(`  подписок:      ${subscriptions.length}`);
  console.log(`  в инбоксе:     ${pending.match(/\d+/)?.[0] ?? "?"}`);
}

main().catch((err) => {
  console.error(`\nСид упал: ${err.message}`);
  process.exit(1);
});
