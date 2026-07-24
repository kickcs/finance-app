import { HumoMessageParser } from './humo-message.parser';
import { ParserRegistry } from './parser-registry';
import { computeDedupHash, computeUnparsedDedupHash } from './dedup-hash';

const PAYMENT = `💸 Оплата
➖ 1.700,00 UZS
📍 TRANSPORT TOLOV>TOS
💳 HUMOCARD *1951
🕓 22:11 12.06.2026
💰 12.543.101,08 UZS`;

const TOPUP = `🎉 Пополнение
➕ 103.500,00 UZS
📍 HAMKOR HUMO P2P>Andi
💳 HUMOCARD *1951
🕓 23:35 11.06.2026
💰 887.801,08 UZS`;

const BALANCE_CHANGE = `ℹ️ Счет по карте изменен
💸 13.244.800,00 UZS
💳 HUMO-CARD *1951
🕘 15:39 12.06.2026`;

const HEADERLESS_EXPENSE = `➖ 36.000,00 UZS
📍 YandexGO Taxi UB OPL
💳 HUMOCARD *1951
🕓 17:55 10.07.2026
💰 370.229,76 UZS`;

const HEADERLESS_INCOME = `➕ 103.500,00 UZS
📍 HAMKOR HUMO P2P>Andi
💳 HUMOCARD *1951
🕓 23:35 11.06.2026
💰 887.801,08 UZS`;

const NEUTRAL_HEADER_EXPENSE = `💸 Операция
➖ 50.000,00 UZS
📍 CLICK P2P FREE HUMO2
💳 HUMOCARD *1951
🕓 22:40 16.07.2026
💰 2.723.732,36 UZS`;

const NEUTRAL_HEADER_INCOME = `💸 Операция
➕ 50.000,00 UZS
📍 CLICK P2P FREE HUMO2
💳 HUMOCARD *1951
🕓 22:40 16.07.2026
💰 2.723.732,36 UZS`;

const REVERSAL = `❌ Отмена операций карты
➕ 82.762,90 UZS
📍 oplata
💳 HUMOCARD *1951
🕓 13:54 22.07.2026
💰 523.419,46 UZS`;

describe('HumoMessageParser', () => {
  const parser = new HumoMessageParser();

  it('canParse возвращает true для всех трёх форматов', () => {
    expect(parser.canParse(PAYMENT)).toBe(true);
    expect(parser.canParse(TOPUP)).toBe(true);
    expect(parser.canParse(BALANCE_CHANGE)).toBe(true);
  });

  it('canParse возвращает false для постороннего текста', () => {
    expect(parser.canParse('привет, как дела?')).toBe(false);
  });

  it('парсит оплату как expense', () => {
    const r = parser.parse(PAYMENT)!;
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(1700);
    expect(r.currency).toBe('UZS');
    expect(r.merchant).toBe('TRANSPORT TOLOV>TOS');
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(12543101.08);
    expect(r.occurredAt.toISOString()).toBe('2026-06-12T17:11:00.000Z'); // 22:11 +05:00
  });

  it('парсит пополнение как income', () => {
    const r = parser.parse(TOPUP)!;
    expect(r.type).toBe('income');
    expect(r.amount).toBe(103500);
    expect(r.merchant).toBe('HAMKOR HUMO P2P>Andi');
    expect(r.balanceAfter).toBe(887801.08);
  });

  it('парсит смену баланса: amount=null, balanceAfter=новый баланс, HUMO-CARD и 🕘 не ломают', () => {
    const r = parser.parse(BALANCE_CHANGE)!;
    expect(r.type).toBe('balance_change');
    expect(r.amount).toBeNull();
    expect(r.merchant).toBeNull();
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(13244800);
    expect(r.occurredAt.toISOString()).toBe('2026-06-12T10:39:00.000Z'); // 15:39 +05:00
  });

  it('терпит лишние пробелы и пустые строки', () => {
    const messy = PAYMENT.split('\n')
      .map((l) => `  ${l}  `)
      .join('\n\n');
    const r = parser.parse(messy)!;
    expect(r.amount).toBe(1700);
    expect(r.cardMask).toBe('*1951');
  });

  it('возвращает null, если нет суммы или карты', () => {
    expect(parser.parse('💸 Оплата\n📍 SHOP')).toBeNull();
  });

  it('парсит суммы без копеек и маленькие суммы', () => {
    const r = parser.parse(PAYMENT.replace('1.700,00', '500,00'))!;
    expect(r.amount).toBe(500);
  });

  it('берёт валюту из строки суммы, а не из мерчанта', () => {
    const msg = `💸 Оплата
➖ 1.700,00 UZS
📍 SHOP 99,00 EUR
💳 HUMOCARD *1951
🕓 22:11 12.06.2026
💰 12.543.101,08 UZS`;
    const r = parser.parse(msg)!;
    expect(r.currency).toBe('UZS');
  });

  it('canParse возвращает false, если маркер не на первой строке', () => {
    expect(parser.canParse('какой-то текст\n💸 Оплата\n➖ 1.700,00 UZS')).toBe(false);
  });

  it('парсит headerless-оплату (первая строка сразу ➖ сумма) как expense', () => {
    expect(parser.canParse(HEADERLESS_EXPENSE)).toBe(true);
    const r = parser.parse(HEADERLESS_EXPENSE)!;
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(36000);
    expect(r.currency).toBe('UZS');
    expect(r.merchant).toBe('YandexGO Taxi UB OPL');
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(370229.76);
    expect(r.occurredAt.toISOString()).toBe('2026-07-10T12:55:00.000Z'); // 17:55 +05:00
  });

  it('парсит headerless-пополнение (первая строка сразу ➕ сумма) как income', () => {
    expect(parser.canParse(HEADERLESS_INCOME)).toBe(true);
    const r = parser.parse(HEADERLESS_INCOME)!;
    expect(r.type).toBe('income');
    expect(r.amount).toBe(103500);
    expect(r.balanceAfter).toBe(887801.08);
  });

  it('canParse остаётся false для текста без маркера и без строки суммы первой строкой', () => {
    expect(parser.canParse('какой-то текст\n➖ 1.700,00 UZS')).toBe(false);
  });

  it('фолбэк по знаку не срабатывает без карты и даты (произвольный текст с суммой)', () => {
    expect(parser.canParse('➖ 1.700,00 UZS\nскинул другу')).toBe(false);
    expect(parser.parse('➖ 1.700,00 UZS\nскинул другу')).toBeNull();
  });

  it('парсит нейтральный заголовок «Операция» как expense по знаку ➖', () => {
    expect(parser.canParse(NEUTRAL_HEADER_EXPENSE)).toBe(true);
    const r = parser.parse(NEUTRAL_HEADER_EXPENSE)!;
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(50000);
    expect(r.currency).toBe('UZS');
    expect(r.merchant).toBe('CLICK P2P FREE HUMO2');
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(2723732.36);
    expect(r.occurredAt.toISOString()).toBe('2026-07-16T17:40:00.000Z'); // 22:40 +05:00
  });

  it('парсит нейтральный заголовок «Операция» как income по знаку ➕', () => {
    const r = parser.parse(NEUTRAL_HEADER_INCOME)!;
    expect(r.type).toBe('income');
    expect(r.amount).toBe(50000);
  });

  it('парсит «Отмена операций карты» как reversal, а не income (маркер приоритетнее знака ➕)', () => {
    expect(parser.canParse(REVERSAL)).toBe(true);
    const r = parser.parse(REVERSAL)!;
    expect(r.type).toBe('reversal');
    expect(r.amount).toBe(82762.9);
    expect(r.currency).toBe('UZS');
    expect(r.merchant).toBe('oplata');
    expect(r.cardMask).toBe('*1951');
    expect(r.balanceAfter).toBe(523419.46);
    expect(r.occurredAt.toISOString()).toBe('2026-07-22T08:54:00.000Z'); // 13:54 +05:00
  });
});

describe('ParserRegistry', () => {
  const registry = new ParserRegistry();

  it('отдаёт null для нераспознанного текста', () => {
    expect(registry.parse('привет, как дела?')).toBeNull();
  });

  it('парсит HUMO-сообщение через зарегистрированный парсер', () => {
    const r = registry.parse(PAYMENT)!;
    expect(r).not.toBeNull();
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(1700);
    expect(r.cardMask).toBe('*1951');
  });
});

describe('dedup-hash', () => {
  const parser = new HumoMessageParser();

  it('одинаковый вход даёт одинаковый хэш длиной 64 hex', () => {
    const a = computeDedupHash(parser.parse(PAYMENT)!);
    const b = computeDedupHash(parser.parse(PAYMENT)!);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('разные сообщения дают разные хэши', () => {
    const a = computeDedupHash(parser.parse(PAYMENT)!);
    const b = computeDedupHash(parser.parse(TOPUP)!);
    expect(a).not.toBe(b);
  });

  it('computeUnparsedDedupHash стабилен к trim и даёт 64 hex', () => {
    const a = computeUnparsedDedupHash('  какой-то нераспознанный текст  ');
    const b = computeUnparsedDedupHash('какой-то нераспознанный текст');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('computeUnparsedDedupHash различает разные тексты', () => {
    const a = computeUnparsedDedupHash('текст один');
    const b = computeUnparsedDedupHash('текст два');
    expect(a).not.toBe(b);
  });
});
