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
