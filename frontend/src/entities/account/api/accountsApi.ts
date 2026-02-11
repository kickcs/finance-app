import { http } from '@/shared/api/http'
import type { Account, AccountInsert, AccountWithBalances, AccountBalance } from '@/shared/api/database.types'

// Response types from NestJS backend (camelCase)
interface AccountResponse {
  id: string
  userId: string
  name: string
  balance: number
  currency: string
  icon: string
  color: string
  type: 'basic' | 'savings'
  order: number
  createdAt: string
}

interface AccountBalanceResponse {
  id: string
  accountId: string
  currency: string
  balance: number
  createdAt: string
}

// Transform camelCase response to snake_case for frontend compatibility
function transformAccount(acc: AccountResponse): Account {
  return {
    id: acc.id,
    user_id: acc.userId,
    name: acc.name,
    balance: acc.balance,
    currency: acc.currency,
    icon: acc.icon,
    color: acc.color,
    type: acc.type,
    order: acc.order,
    created_at: acc.createdAt,
  }
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

export const accountsApi = {
  async getAll(_userId: string): Promise<Account[]> {
    // Backend gets userId from JWT token
    const data = await http.get<AccountResponse[]>('/accounts')
    return data.map(transformAccount)
  },

  async getAllWithBalances(_userId: string): Promise<AccountWithBalances[]> {
    // Backend gets userId from JWT token and returns accounts with balances
    const data = await http.get<(AccountResponse & { balances: AccountBalanceResponse[] })[]>('/accounts')
    return data.map((acc) => ({
      id: acc.id,
      user_id: acc.userId,
      name: acc.name,
      icon: acc.icon,
      color: acc.color,
      type: acc.type,
      order: acc.order,
      created_at: acc.createdAt,
      balances: acc.balances?.map(transformBalance) ?? [],
    }))
  },

  async getById(accountId: string): Promise<Account | null> {
    try {
      const data = await http.get<AccountResponse>(`/accounts/${accountId}`)
      return transformAccount(data)
    } catch {
      return null
    }
  },

  async getByIdWithBalances(accountId: string): Promise<AccountWithBalances | null> {
    try {
      const data = await http.get<AccountResponse & { balances: AccountBalanceResponse[] }>(
        `/accounts/${accountId}/with-balances`
      )
      return {
        id: data.id,
        user_id: data.userId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        type: data.type,
        order: data.order,
        created_at: data.createdAt,
        balances: data.balances.map(transformBalance),
      }
    } catch {
      return null
    }
  },

  async create(account: AccountInsert): Promise<Account> {
    // Backend gets userId from JWT token
    // Note: CreateAccountDto doesn't have balance/currency directly, uses balances array
    const data = await http.post<AccountResponse>('/accounts', {
      name: account.name,
      icon: account.icon,
      color: account.color,
      type: account.type ?? 'basic',
      order: account.order ?? 0,
      // If balance and currency are provided, convert to balances array
      balances: account.currency && account.balance !== undefined
        ? [{ currency: account.currency, balance: account.balance }]
        : undefined,
    })
    return transformAccount(data)
  },

  async createWithBalances(
    account: Omit<AccountInsert, 'balance' | 'currency'>,
    balances: Array<{ currency: string; balance: number }>
  ): Promise<AccountWithBalances> {
    // Backend gets userId from JWT token
    const data = await http.post<AccountResponse & { balances: AccountBalanceResponse[] }>(
      '/accounts',
      {
        name: account.name,
        icon: account.icon,
        color: account.color,
        type: account.type ?? 'basic',
        order: account.order ?? 0,
        balances,
      }
    )
    return {
      id: data.id,
      user_id: data.userId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      type: data.type,
      order: data.order,
      created_at: data.createdAt,
      balances: data.balances?.map(transformBalance) ?? [],
    }
  },

  async update(id: string, updates: Partial<Account>): Promise<Account> {
    // Note: UpdateAccountDto doesn't have balance/currency
    // Account balances should be updated via account-balances endpoints
    const data = await http.patch<AccountResponse>(`/accounts/${id}`, {
      name: updates.name,
      icon: updates.icon,
      color: updates.color,
      type: updates.type,
      order: updates.order,
    })
    return transformAccount(data)
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/accounts/${id}`)
  },
}
