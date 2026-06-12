import * as crypto from 'crypto';
import { type ParsedBankMessage } from './parsed-bank-message';

export function computeDedupHash(parsed: ParsedBankMessage): string {
  const payload = [
    parsed.cardMask,
    parsed.type,
    parsed.occurredAt.toISOString(),
    parsed.amount ?? '',
    parsed.balanceAfter ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function computeUnparsedDedupHash(rawText: string): string {
  return crypto.createHash('sha256').update(rawText.trim()).digest('hex');
}
