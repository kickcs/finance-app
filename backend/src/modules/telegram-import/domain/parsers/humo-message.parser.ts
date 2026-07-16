import {
  type BankMessageParser,
  type ParsedBankMessage,
  type ParsedMessageType,
} from './parsed-bank-message';

const TYPE_MARKERS: Array<{ marker: string; type: ParsedMessageType }> = [
  { marker: 'Оплата', type: 'expense' },
  { marker: 'Пополнение', type: 'income' },
  { marker: 'Счет по карте изменен', type: 'balance_change' },
];

/** '12.543.101,08' -> 12543101.08 */
function parseUzAmount(raw: string): number | null {
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

const AMOUNT_RE = /([\d.]+,\d{2})\s*([A-Z]{3})/;
const CARD_RE = /💳[^*]*(\*\d+)/;
const DATETIME_RE = /(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})/;

/**
 * Тип по знаку строки суммы «➖/➕ …». Фолбэк для сообщений, где заголовка нет вовсе
 * или он нейтральный («Операция») и о направлении операции ничего не говорит.
 *
 * Сумма ищется среди первых двух строк: перед ней может стоять только заголовок.
 * Обязательны карта и дата — без них это произвольный текст, где сумма попалась
 * случайно, а не уведомление банка.
 */
function typeFromAmountSign(text: string, lines: string[]): ParsedMessageType | null {
  if (!CARD_RE.test(text) || !DATETIME_RE.test(text)) return null;
  const amountLine = lines.slice(0, 2).find((l) => AMOUNT_RE.test(l));
  if (!amountLine) return null;
  if (amountLine.startsWith('➖')) return 'expense';
  if (amountLine.startsWith('➕')) return 'income';
  return null;
}

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export class HumoMessageParser implements BankMessageParser {
  canParse(text: string): boolean {
    const lines = toLines(text);
    if (lines.length === 0) return false;
    return (
      TYPE_MARKERS.some(({ marker }) => lines[0].includes(marker)) ||
      typeFromAmountSign(text, lines) !== null
    );
  }

  parse(text: string): ParsedBankMessage | null {
    const lines = toLines(text);
    if (lines.length === 0) return null;

    const typeEntry = TYPE_MARKERS.find(({ marker }) => lines[0].includes(marker));
    const type = typeEntry?.type ?? typeFromAmountSign(text, lines);
    if (!type) return null;

    const cardMatch = text.match(CARD_RE);
    const dtMatch = text.match(DATETIME_RE);
    if (!cardMatch || !dtMatch) return null;

    const [, hh, min, dd, mm, yyyy] = dtMatch;
    const occurredAt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+05:00`);
    if (Number.isNaN(occurredAt.getTime())) return null;

    const merchantLine = lines.find((l) => l.startsWith('📍'));
    const merchant = merchantLine ? merchantLine.replace('📍', '').trim() : null;

    let amount: number | null = null;
    let balanceAfter: number | null = null;
    let currency = 'UZS';

    if (type === 'balance_change') {
      // 💸 здесь — новый баланс карты, суммы операции нет
      const balanceLine = lines.find((l) => l.startsWith('💸'));
      const m = balanceLine?.match(AMOUNT_RE);
      if (!m) return null;
      balanceAfter = parseUzAmount(m[1]);
      currency = m[2] || 'UZS';
    } else {
      const amountLine = lines.find((l) => l.startsWith('➖') || l.startsWith('➕'));
      const am = amountLine?.match(AMOUNT_RE);
      if (!am) return null;
      amount = parseUzAmount(am[1]);
      if (amount === null) return null;
      currency = am[2] || 'UZS';

      const balanceLine = lines.find((l) => l.startsWith('💰'));
      const bm = balanceLine?.match(AMOUNT_RE);
      balanceAfter = bm ? parseUzAmount(bm[1]) : null;
    }

    return {
      type,
      amount,
      currency,
      merchant,
      cardMask: cardMatch[1],
      occurredAt,
      balanceAfter,
    };
  }
}
