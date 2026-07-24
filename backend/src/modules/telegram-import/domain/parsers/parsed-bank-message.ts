export type ParsedMessageType = 'expense' | 'income' | 'balance_change' | 'reversal';

export interface ParsedBankMessage {
  type: ParsedMessageType;
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string;
  occurredAt: Date;
  balanceAfter: number | null;
}

export interface BankMessageParser {
  canParse(text: string): boolean;
  parse(text: string): ParsedBankMessage | null;
}
