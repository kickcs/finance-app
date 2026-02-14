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
  type: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit'
  order: number
  createdAt: string
  creditLimit: number | null
  gracePeriodDays: number | null
  billingDay: number | null
  totalAmount: number | null
  interestRate: number | null
  monthlyPayment: number | null
  startDate: string | null
  endDate: string | null
  maturityDate: string | null
  isReplenishable: boolean | null
  isWithdrawable: boolean | null
}

interface AccountBalanceResponse {
  id: string
  accountId: string
  currency: string
  balance: number
  createdAt: string
}

// Transform camelCase response to snake_case for frontend compatibility
function transformAccountBase(acc: AccountResponse) {
  return {
    id: acc.id,
    user_id: acc.userId,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
    type: acc.type,
    order: acc.order,
    created_at: acc.createdAt,
    credit_limit: acc.creditLimit,
    grace_period_days: acc.gracePeriodDays,
    billing_day: acc.billingDay,
    total_amount: acc.totalAmount,
    interest_rate: acc.interestRate,
    monthly_payment: acc.monthlyPayment,
    start_date: acc.startDate,
    end_date: acc.endDate,
    maturity_date: acc.maturityDate,
    is_replenishable: acc.isReplenishable,
    is_withdrawable: acc.isWithdrawable,
  }
}

function transformAccount(acc: AccountResponse): Account {
  return {
    ...transformAccountBase(acc),
    balance: acc.balance,
    currency: acc.currency,
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

function transformAccountWithBalances(acc: AccountResponse & { balances: AccountBalanceResponse[] }): AccountWithBalances {
  return {
    ...transformAccountBase(acc),
    balances: acc.balances?.map(transformBalance) ?? [],
  }
}

function mapTypeFieldsToRequest(account: { credit_limit?: number | null; grace_period_days?: number | null; billing_day?: number | null; total_amount?: number | null; interest_rate?: number | null; monthly_payment?: number | null; start_date?: string | null; end_date?: string | null; maturity_date?: string | null; is_replenishable?: boolean | null; is_withdrawable?: boolean | null }) {
  return {
    creditLimit: account.credit_limit,
    gracePeriodDays: account.grace_period_days,
    billingDay: account.billing_day,
    totalAmount: account.total_amount,
    interestRate: account.interest_rate,
    monthlyPayment: account.monthly_payment,
    startDate: account.start_date,
    endDate: account.end_date,
    maturityDate: account.maturity_date,
    isReplenishable: account.is_replenishable,
    isWithdrawable: account.is_withdrawable,
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
    return data.map(transformAccountWithBalances)
  },

  async getById(accountId: string): Promise<Account | null> {
    try {
      const data = await http.get<AccountResponse>(`/accounts/${accountId}`)
      return transformAccount(data)
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 404) {
        return null
      }
      throw e
    }
  },

  async getByIdWithBalances(accountId: string): Promise<AccountWithBalances | null> {
    try {
      const data = await http.get<AccountResponse & { balances: AccountBalanceResponse[] }>(
        `/accounts/${accountId}/with-balances`
      )
      return transformAccountWithBalances(data)
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 404) {
        return null
      }
      throw e
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
      balances: account.currency && account.balance !== undefined
        ? [{ currency: account.currency, balance: account.balance }]
        : undefined,
      ...mapTypeFieldsToRequest(account),
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
        ...mapTypeFieldsToRequest(account),
      }
    )
    return transformAccountWithBalances(data)
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
      ...mapTypeFieldsToRequest(updates),
    })
    return transformAccount(data)
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/accounts/${id}`)
  },
}
