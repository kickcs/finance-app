import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { IngestBankMessageCommand } from './ingest-bank-message.command';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';
import {
  type IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import { ParserRegistry } from '../../../domain/parsers/parser-registry';
import { computeDedupHash, computeUnparsedDedupHash } from '../../../domain/parsers/dedup-hash';

export type IngestResult =
  | 'imported'
  | 'duplicate'
  | 'unparsed'
  | 'not_linked'
  | 'reversal_applied';

@CommandHandler(IngestBankMessageCommand)
export class IngestBankMessageHandler implements ICommandHandler<IngestBankMessageCommand> {
  private readonly registry = new ParserRegistry();

  constructor(
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
    @Inject(IMPORTED_TRANSACTION_REPOSITORY)
    private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(command: IngestBankMessageCommand): Promise<IngestResult> {
    const link = await this.linkRepo.findByTelegramUserId(command.telegramUserId);
    if (!link) return 'not_linked';

    const parsed = this.registry.parse(command.text);

    if (!parsed) {
      const inserted = await this.importedRepo.insertIfNew({
        userId: link.userId,
        rawText: command.text,
        type: 'unparsed',
        amount: null,
        currency: 'UZS',
        merchant: null,
        cardMask: null,
        occurredAt: null,
        balanceAfter: null,
        dedupHash: computeUnparsedDedupHash(command.text),
      });
      return inserted ? 'unparsed' : 'duplicate';
    }

    // Отмена/возврат операции: не создаём доход, а уменьшаем связанный расход.
    // Reversal-запись сохраняется как dismissed — она нужна только для дедупа
    // (повторный форвард той же отмены не уменьшит расход дважды) и не попадает в инбокс.
    if (parsed.type === 'reversal') {
      const inserted = await this.importedRepo.insertIfNew({
        userId: link.userId,
        rawText: command.text,
        type: 'reversal',
        amount: parsed.amount,
        currency: parsed.currency,
        merchant: parsed.merchant,
        cardMask: parsed.cardMask,
        occurredAt: parsed.occurredAt,
        balanceAfter: parsed.balanceAfter,
        dedupHash: computeDedupHash(parsed),
        status: 'dismissed',
      });
      if (!inserted) return 'duplicate';

      if (parsed.amount !== null) {
        const target = await this.importedRepo.findLatestPendingExpenseByCard(
          link.userId,
          parsed.cardMask,
          parsed.occurredAt,
        );
        if (target) {
          await this.importedRepo.decreaseAmount(target.id, parsed.amount);
          return 'reversal_applied';
        }
      }
      // Исходный расход не найден (отмена пришла первой либо расход уже подтверждён/вне
      // инбокса) — дохода не создаём, помечаем как нераспознанное для сводки бота.
      return 'unparsed';
    }

    let amount = parsed.amount;
    if (parsed.type === 'balance_change' && parsed.balanceAfter !== null) {
      const prev = await this.importedRepo.findLatestBalance(
        link.userId,
        parsed.cardMask,
        parsed.occurredAt,
      );
      amount = prev === null ? null : Math.round((parsed.balanceAfter - prev) * 100) / 100;
    }

    const inserted = await this.importedRepo.insertIfNew({
      userId: link.userId,
      rawText: command.text,
      type: parsed.type,
      amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      cardMask: parsed.cardMask,
      occurredAt: parsed.occurredAt,
      balanceAfter: parsed.balanceAfter,
      dedupHash: computeDedupHash(parsed),
    });
    return inserted ? 'imported' : 'duplicate';
  }
}
