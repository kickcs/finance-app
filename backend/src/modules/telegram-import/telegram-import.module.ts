import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CardAccountMappingOrmEntity,
  ImportedTransactionOrmEntity,
  TelegramLinkOrmEntity,
  TelegramLinkTokenOrmEntity,
} from './infrastructure/persistence/typeorm';
import { TELEGRAM_LINK_REPOSITORY } from './domain/repositories/telegram-link.repository.interface';
import { LINK_TOKEN_REPOSITORY } from './domain/repositories/link-token.repository.interface';
import { IMPORTED_TRANSACTION_REPOSITORY } from './domain/repositories/imported-transaction.repository.interface';
import { CARD_MAPPING_REPOSITORY } from './domain/repositories/card-mapping.repository.interface';
import { TelegramLinkRepository } from './infrastructure/persistence/repositories/telegram-link.repository';
import { LinkTokenRepository } from './infrastructure/persistence/repositories/link-token.repository';
import { ImportedTransactionRepository } from './infrastructure/persistence/repositories/imported-transaction.repository';
import { CardMappingRepository } from './infrastructure/persistence/repositories/card-mapping.repository';
import { TelegramBotService } from './infrastructure/telegram/telegram-bot.service';
import { TelegramWebhookController } from './presentation/controllers/telegram-webhook.controller';
import { TelegramImportController } from './presentation/controllers/telegram-import.controller';
import { TmaController } from './presentation/controllers/tma.controller';
import { CommandHandlers } from './application/commands';
import { QueryHandlers } from './application/queries';
import { AccountingModule } from '../accounting/accounting.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    AccountingModule,
    IdentityModule,
    TypeOrmModule.forFeature([
      TelegramLinkOrmEntity,
      TelegramLinkTokenOrmEntity,
      ImportedTransactionOrmEntity,
      CardAccountMappingOrmEntity,
    ]),
  ],
  controllers: [TelegramWebhookController, TelegramImportController, TmaController],
  providers: [
    { provide: TELEGRAM_LINK_REPOSITORY, useClass: TelegramLinkRepository },
    { provide: LINK_TOKEN_REPOSITORY, useClass: LinkTokenRepository },
    { provide: IMPORTED_TRANSACTION_REPOSITORY, useClass: ImportedTransactionRepository },
    { provide: CARD_MAPPING_REPOSITORY, useClass: CardMappingRepository },
    TelegramBotService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
})
export class TelegramImportModule {}
