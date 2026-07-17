import { http } from '@/shared/api/http';
import type {
  ImportedTransaction,
  TelegramCard,
  TelegramLinkStatus,
  TmaAuthResponse,
} from '../model/types';

interface ImportedTransactionResponse {
  id: string;
  type: ImportedTransaction['type'];
  amount: number | null;
  currency: string;
  merchant: string | null;
  cardMask: string;
  occurredAt: string | null;
  balanceAfter: number | null;
  status: ImportedTransaction['status'];
  transactionId: string | null;
  suggestedAccountId: string | null;
  suggestedCategoryId: string | null;
  createdAt: string;
}

function transformImported(item: ImportedTransactionResponse): ImportedTransaction {
  return {
    id: item.id,
    type: item.type,
    amount: item.amount === null ? null : Number(item.amount),
    currency: item.currency,
    merchant: item.merchant,
    card_mask: item.cardMask,
    occurred_at: item.occurredAt,
    balance_after: item.balanceAfter === null ? null : Number(item.balanceAfter),
    status: item.status,
    transaction_id: item.transactionId,
    suggested_account_id: item.suggestedAccountId,
    // ?? null — защита от бэкенда без этого поля (деплой фронта раньше бэка)
    suggested_category_id: item.suggestedCategoryId ?? null,
    created_at: item.createdAt,
  };
}

export const importedTransactionsApi = {
  async getInbox(): Promise<{ items: ImportedTransaction[]; count: number }> {
    const data = await http.get<{ items: ImportedTransactionResponse[]; count: number }>(
      '/telegram-import/inbox',
    );
    return { items: data.items.map(transformImported), count: data.count };
  },

  async confirm(
    id: string,
    payload: { transactionId: string; accountId: string; toAccountId?: string },
  ): Promise<{ success: boolean; counterpartId: string | null }> {
    return http.post(`/telegram-import/inbox/${id}/confirm`, payload);
  },

  async dismiss(id: string): Promise<{ success: boolean }> {
    return http.post(`/telegram-import/inbox/${id}/dismiss`);
  },

  async getLinkStatus(): Promise<TelegramLinkStatus> {
    const data = await http.get<{ linked: boolean; telegramUsername: string | null }>(
      '/telegram-import/link',
    );
    return { linked: data.linked, telegram_username: data.telegramUsername };
  },

  async createLinkToken(): Promise<{ deepLink: string }> {
    return http.post<{ deepLink: string }>('/telegram-import/link-token');
  },

  async unlink(): Promise<{ success: boolean }> {
    return http.delete('/telegram-import/link');
  },

  async getCards(): Promise<TelegramCard[]> {
    const data = await http.get<{
      cards: Array<{ cardMask: string; accountId: string | null; lastSeenAt: string | null }>;
    }>('/telegram-import/cards');
    return data.cards.map((c) => ({
      card_mask: c.cardMask,
      account_id: c.accountId,
      last_seen_at: c.lastSeenAt,
    }));
  },

  async setCardAccount(cardMask: string, accountId: string): Promise<{ success: boolean }> {
    return http.put(`/telegram-import/cards/${encodeURIComponent(cardMask)}`, { accountId });
  },

  async deleteCardMapping(cardMask: string): Promise<{ success: boolean }> {
    return http.delete(`/telegram-import/cards/${encodeURIComponent(cardMask)}`);
  },

  async tmaAuth(initData: string): Promise<TmaAuthResponse> {
    return http.post<TmaAuthResponse>(
      '/telegram-import/tma-auth',
      { initData },
      { skipAuth: true },
    );
  },

  async tmaLink(initData: string): Promise<{ success: boolean }> {
    return http.post<{ success: boolean }>('/telegram-import/tma-link', { initData });
  },
};
