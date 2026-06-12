export * from './create-link-token/create-link-token.command';
export * from './create-link-token/create-link-token.handler';
export * from './link-telegram-account/link-telegram-account.command';
export * from './link-telegram-account/link-telegram-account.handler';
export * from './unlink-telegram/unlink-telegram.command';
export * from './unlink-telegram/unlink-telegram.handler';
export * from './ingest-bank-message/ingest-bank-message.command';
export * from './ingest-bank-message/ingest-bank-message.handler';
export * from './confirm-imported/confirm-imported.command';
export * from './confirm-imported/confirm-imported.handler';
export * from './dismiss-imported/dismiss-imported.command';
export * from './dismiss-imported/dismiss-imported.handler';
export * from './set-card-mapping/set-card-mapping.command';
export * from './set-card-mapping/set-card-mapping.handler';
export * from './delete-card-mapping/delete-card-mapping.command';
export * from './delete-card-mapping/delete-card-mapping.handler';

import { CreateLinkTokenHandler } from './create-link-token/create-link-token.handler';
import { LinkTelegramAccountHandler } from './link-telegram-account/link-telegram-account.handler';
import { UnlinkTelegramHandler } from './unlink-telegram/unlink-telegram.handler';
import { IngestBankMessageHandler } from './ingest-bank-message/ingest-bank-message.handler';
import { ConfirmImportedHandler } from './confirm-imported/confirm-imported.handler';
import { DismissImportedHandler } from './dismiss-imported/dismiss-imported.handler';
import { SetCardMappingHandler } from './set-card-mapping/set-card-mapping.handler';
import { DeleteCardMappingHandler } from './delete-card-mapping/delete-card-mapping.handler';

export const CommandHandlers = [
  CreateLinkTokenHandler,
  LinkTelegramAccountHandler,
  UnlinkTelegramHandler,
  IngestBankMessageHandler,
  ConfirmImportedHandler,
  DismissImportedHandler,
  SetCardMappingHandler,
  DeleteCardMappingHandler,
];
