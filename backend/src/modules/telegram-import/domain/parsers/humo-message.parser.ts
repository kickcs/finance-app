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

export class HumoMessageParser implements BankMessageParser {
  canParse(text: string): boolean {
    const firstLine = text.trim().split('\n')[0] ?? '';
    return TYPE_MARKERS.some(({ marker }) => firstLine.includes(marker));
  }

  parse(text: string): ParsedBankMessage | null {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return null;

    const typeEntry = TYPE_MARKERS.find(({ marker }) => lines[0].includes(marker));
    if (!typeEntry) return null;
    const type = typeEntry.type;

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

    if (type === 'balance_change') {
      // 💸 здесь — новый баланс карты, суммы операции нет
      const balanceLine = lines.find((l) => l.startsWith('💸'));
      const m = balanceLine?.match(AMOUNT_RE);
      if (!m) return null;
      balanceAfter = parseUzAmount(m[1]);
    } else {
      const amountLine = lines.find((l) => l.startsWith('➖') || l.startsWith('➕'));
      const am = amountLine?.match(AMOUNT_RE);
      if (!am) return null;
      amount = parseUzAmount(am[1]);
      if (amount === null) return null;

      const balanceLine = lines.find((l) => l.startsWith('💰'));
      const bm = balanceLine?.match(AMOUNT_RE);
      balanceAfter = bm ? parseUzAmount(bm[1]) : null;
    }

    const currencyMatch = text.match(AMOUNT_RE);
    const currency = currencyMatch ? currencyMatch[2] : 'UZS';

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
