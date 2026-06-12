import { type CardAccountMapping, type CardWithMapping } from '../models';

export const CARD_MAPPING_REPOSITORY = Symbol('CARD_MAPPING_REPOSITORY');

export interface ICardMappingRepository {
  findByUserAndCard(userId: string, cardMask: string): Promise<CardAccountMapping | null>;
  upsert(mapping: CardAccountMapping): Promise<void>;
  delete(userId: string, cardMask: string): Promise<void>;
  /** Все замеченные карты: distinct из imported_transactions LEFT JOIN mappings */
  listCards(userId: string): Promise<CardWithMapping[]>;
}
