import { http } from '@/shared/api/http'
import type { AccountBalance } from '@/shared/api/database.types'

// Response type from NestJS backend (camelCase)
interface AccountBalanceResponse {
  id: string
  accountId: string
  currency: string
  balance: number
  createdAt: string
}

function transformBalance(bal: AccountBalanceResponse): AccountBalance {
  return {
    id: bal.id,
    account_id: bal.accountId,
    currency: bal.currency,
    balance: bal.balance,
    created_at: bal.createdAt,
  }
}

export const accountBalancesApi = {
  async getByAccountId(accountId: string): Promise<AccountBalance[]> {
    const data = await http.get<AccountBalanceResponse[]>(`/account-balances/by-account/${accountId}`)
    return data.map(transformBalance)
  },

  async getByAccountIds(accountIds: string[]): Promise<AccountBalance[]> {
    if (accountIds.length === 0) return []

    const data = await http.post<AccountBalanceResponse[]>('/account-balances/by-accounts', {
      accountIds,
    })
    return data.map(transformBalance)
  },

  async upsert(accountId: string, currency: string, balance: number): Promise<AccountBalance> {
    const data = await http.post<AccountBalanceResponse>('/account-balances/upsert', {
      accountId,
      currency,
      balance,
    })
    return transformBalance(data)
  },

  async createMany(
    accountId: string,
    balances: Array<{ currency: string; balance: number }>
  ): Promise<AccountBalance[]> {
    const data = await http.post<AccountBalanceResponse[]>('/account-balances/create-many', {
      accountId,
      balances,
    })
    return data.map(transformBalance)
  },

  async updateByDelta(accountId: string, currency: string, delta: number): Promise<AccountBalance> {
    const data = await http.post<AccountBalanceResponse>('/account-balances/update-by-delta', {
      accountId,
      currency,
      delta,
    })
    return transformBalance(data)
  },

  async delete(accountId: string, currency: string): Promise<void> {
    await http.delete(`/account-balances/${accountId}/${currency}`)
  },

  async deleteByAccountId(accountId: string): Promise<void> {
    await http.delete(`/account-balances/by-account/${accountId}`)
  },
}
