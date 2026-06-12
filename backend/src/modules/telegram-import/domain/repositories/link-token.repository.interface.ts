export const LINK_TOKEN_REPOSITORY = Symbol('LINK_TOKEN_REPOSITORY');

export interface ILinkTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<void>;
  /** Возвращает userId, если токен валиден (не истёк, не использован), иначе null. Помечает использованным. */
  consume(token: string): Promise<string | null>;
}
