import { type BankMessageParser, type ParsedBankMessage } from './parsed-bank-message';
import { HumoMessageParser } from './humo-message.parser';

export class ParserRegistry {
  private readonly parsers: BankMessageParser[] = [new HumoMessageParser()];

  parse(text: string): ParsedBankMessage | null {
    for (const parser of this.parsers) {
      if (parser.canParse(text)) {
        const result = parser.parse(text);
        if (result) return result;
      }
    }
    return null;
  }
}
