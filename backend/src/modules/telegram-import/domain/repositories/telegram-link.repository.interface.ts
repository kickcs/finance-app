import { type TelegramLink } from '../models';

export const TELEGRAM_LINK_REPOSITORY = Symbol('TELEGRAM_LINK_REPOSITORY');

export interface ITelegramLinkRepository {
  findByUserId(userId: string): Promise<TelegramLink | null>;
  findByTelegramUserId(telegramUserId: string): Promise<TelegramLink | null>;
  save(link: Omit<TelegramLink, 'id' | 'createdAt'>): Promise<TelegramLink>;
  deleteByUserId(userId: string): Promise<void>;
}
