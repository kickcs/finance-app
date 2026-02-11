<script setup lang="ts">
import { computed, inject, defineAsyncComponent, Suspense } from 'vue'
import type { Ref } from 'vue'
import type { User } from '@/shared/api/composables/useAuth'
import { useRouter } from 'vue-router'

// Critical components - load immediately
import { AppHeader } from '@/widgets/header'
import { BottomNav } from '@/widgets/bottom-nav'
import { ThemeToggle } from '@/features/toggle-theme'

// Skeleton components - load immediately for fallbacks
import { BalanceCardSkeleton } from '@/widgets/balance-card'
import { AccountStackSkeleton } from '@/widgets/account-stack'
import { SaveSpendSectionSkeleton } from '@/widgets/save-spend-section'
import { DebtsSectionSkeleton } from '@/widgets/debts-section'
import { RemindersSectionSkeleton } from '@/widgets/reminders-section'

// Lazy load heavy widget components
const BalanceCard = defineAsyncComponent({
  loader: () => import('@/widgets/balance-card/ui/BalanceCard.vue'),
  delay: 0,
})

const AccountStack = defineAsyncComponent({
  loader: () => import('@/widgets/account-stack/ui/AccountStack.vue'),
  delay: 0,
})

const SaveSpendSection = defineAsyncComponent({
  loader: () => import('@/widgets/save-spend-section/ui/SaveSpendSection.vue'),
  delay: 0,
})

const DebtsSection = defineAsyncComponent({
  loader: () => import('@/widgets/debts-section/ui/DebtsSection.vue'),
  delay: 0,
})

const RemindersSection = defineAsyncComponent({
  loader: () => import('@/widgets/reminders-section/ui/RemindersSection.vue'),
  delay: 0,
})

// API composables
import { useAccounts, type AccountWithBalances } from '@/entities/account'
import { useMonthlyStats } from '@/entities/transaction'
import { useDebts, type Debt } from '@/entities/debt'
import { useReminders, type Reminder } from '@/entities/reminder'
import { useProfile, useExchangeRates } from '@/shared/api'

const router = useRouter()

// Get user from provide/inject
const user = inject<Ref<User | null>>('user')
const userId = computed(() => user?.value?.id ?? '')

// Get user currency from profile (fallback to localStorage for backward compatibility)
const { profile } = useProfile(userId)
const currency = computed(() => profile.value?.currency || localStorage.getItem('selectedCurrency') || 'UZS')

// Exchange rates for currency conversion
const { convert, isLoading: ratesLoading } = useExchangeRates(currency)

// Use real data from API (pass reactive userId, not .value)
const { accounts, totalBalancesByCurrency, isLoading: accountsLoading } = useAccounts(userId)
const { debts, isLoading: debtsLoading } = useDebts(userId)
const { reminders, isLoading: remindersLoading } = useReminders(userId)

// Monthly statistics from server (accurate, no limit issues)
const now = new Date()
const {
  incomeByCurrency,
  expenseByCurrency,
  isLoading: statsLoading,
} = useMonthlyStats(userId, { year: now.getFullYear(), month: now.getMonth() + 1 })

// Last month stats for percent change calculation
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const {
  incomeByCurrency: lastMonthIncomeByCurrency,
  expenseByCurrency: lastMonthExpenseByCurrency,
} = useMonthlyStats(userId, { year: lastMonth.getFullYear(), month: lastMonth.getMonth() + 1 })

// Total balance converted to user's main currency
const totalBalance = computed(() => {
  const balances = totalBalancesByCurrency.value
  let total = 0
  for (const [curr, amount] of Object.entries(balances)) {
    total += convert(amount, curr)
  }
  return total
})

// Calculate saved/spent this month from server stats
// Convert each currency amount to user's main currency
const savedThisMonth = computed(() => {
  let total = 0
  for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
    total += convert(amount, curr)
  }
  return total
})

const spentThisMonth = computed(() => {
  let total = 0
  for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
    total += convert(amount, curr)
  }
  return total
})

// Calculate percent change compared to last month
// Compares savings rate (income - expenses) between months
const percentChange = computed(() => {
  // This month totals (converted to main currency)
  let thisMonthIncome = 0
  for (const [curr, amount] of Object.entries(incomeByCurrency.value)) {
    thisMonthIncome += convert(amount, curr)
  }
  let thisMonthExpense = 0
  for (const [curr, amount] of Object.entries(expenseByCurrency.value)) {
    thisMonthExpense += convert(amount, curr)
  }

  // Last month totals (converted to main currency)
  let lastMonthIncome = 0
  for (const [curr, amount] of Object.entries(lastMonthIncomeByCurrency.value)) {
    lastMonthIncome += convert(amount, curr)
  }
  let lastMonthExpense = 0
  for (const [curr, amount] of Object.entries(lastMonthExpenseByCurrency.value)) {
    lastMonthExpense += convert(amount, curr)
  }

  // If no data for last month, return undefined to hide the indicator
  if (lastMonthIncome === 0 && lastMonthExpense === 0) {
    return undefined
  }

  // Calculate savings rates for both months
  const thisMonthSavings = thisMonthIncome - thisMonthExpense
  const lastMonthSavings = lastMonthIncome - lastMonthExpense

  // If no savings last month, show simple change indicator
  if (lastMonthSavings === 0) {
    return thisMonthSavings > 0 ? 100 : thisMonthSavings < 0 ? -100 : 0
  }

  // Percentage change in savings
  return ((thisMonthSavings - lastMonthSavings) / Math.abs(lastMonthSavings)) * 100
})

function handleAccountClick(account: AccountWithBalances) {
  router.push(`/accounts/${account.id}`)
}

function handleAddAccount() {
  router.push('/accounts/new')
}

function handleViewAllAccounts() {
  router.push('/accounts')
}

function handleAddTransaction() {
  router.push('/transactions/new')
}

function handleIncomeClick() {
  router.push('/transactions/new?type=income')
}

function handleExpenseClick() {
  router.push('/transactions/new?type=expense')
}

function handleAddReminder() {
  router.push({ name: 'new-reminder' })
}

function handleAddDebt() {
  router.push({ name: 'new-debt' })
}

function handleDebtClick(debt: Debt) {
  router.push({ name: 'debt-detail', params: { id: debt.id } })
}

function handlePersonClick(personName: string, debtType: 'given' | 'taken') {
  router.push({ path: '/debts', query: { person: personName, type: debtType } })
}

function handleViewAllDebts() {
  router.push('/debts')
}

function handleReminderClick(reminder: Reminder) {
  router.push({ name: 'reminder-detail', params: { id: reminder.id } })
}

function handleViewAllReminders() {
  router.push('/reminders')
}
</script>

<template>
  <div class="relative min-h-screen bg-background-light dark:bg-background-dark">
    <div :style="{ paddingBottom: 'calc(7rem + var(--safe-area-inset-bottom))' }">
      <!-- Header -->
      <AppHeader>
      <template #logo>
        <div
          class="flex items-center gap-2.5 group cursor-pointer"
          @click="router.push('/profile')"
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center
                   bg-gradient-to-br from-primary to-primary-hover
                   shadow-lg shadow-primary/25
                   group-hover:shadow-xl group-hover:shadow-primary/30
                   group-hover:scale-105
                   transition-all duration-200"
          >
            <span class="text-white font-bold text-base">O</span>
          </div>
          <span
            class="font-bold text-lg text-text-primary-light dark:text-text-primary-dark
                   group-hover:text-primary transition-colors"
          >
            Ouro
          </span>
        </div>
      </template>
      <template #actions>
        <ThemeToggle />
      </template>
    </AppHeader>

    <!-- Content with grouped sections -->
    <main class="relative z-10 px-5 pt-8 space-y-8">
      <!-- Hero Section - tight grouping for balance and stats -->
      <section class="space-y-4 animate-fadeInUp">
        <!-- Balance Card with Suspense -->
        <Suspense>
          <BalanceCard
            :total-balance="totalBalance"
            :currency="currency"
            :percent-change="percentChange"
            :loading="accountsLoading || statsLoading || ratesLoading"
            @income-click="handleIncomeClick"
            @expense-click="handleExpenseClick"
          />
          <template #fallback>
            <BalanceCardSkeleton />
          </template>
        </Suspense>

        <!-- Save & Spend with Suspense -->
        <Suspense>
          <SaveSpendSection
            :saved-amount="savedThisMonth"
            :spent-amount="spentThisMonth"
            :currency="currency"
            :loading="statsLoading"
          />
          <template #fallback>
            <SaveSpendSectionSkeleton />
          </template>
        </Suspense>
      </section>

      <!-- Finance Section -->
      <section class="space-y-5 animate-fadeInUp" style="animation-delay: 0.1s;">
        <!-- Accounts with Suspense -->
        <Suspense>
          <AccountStack
            :accounts="accounts"
            :loading="accountsLoading"
            @account-click="handleAccountClick"
            @add-click="handleAddAccount"
            @view-all="handleViewAllAccounts"
          />
          <template #fallback>
            <AccountStackSkeleton />
          </template>
        </Suspense>

        <!-- Debts with Suspense -->
        <Suspense>
          <DebtsSection
            :debts="debts"
            :currency="currency"
            :loading="debtsLoading"
            @debt-click="handleDebtClick"
            @person-click="handlePersonClick"
            @add-click="handleAddDebt"
            @view-all="handleViewAllDebts"
          />
          <template #fallback>
            <DebtsSectionSkeleton />
          </template>
        </Suspense>
      </section>

      <!-- Utilities Section -->
      <section class="animate-fadeInUp" style="animation-delay: 0.2s;">
        <!-- Reminders (Subscriptions) with Suspense -->
        <Suspense>
          <RemindersSection
            :reminders="reminders"
            :currency="currency"
            :loading="remindersLoading"
            @reminder-click="handleReminderClick"
            @add-click="handleAddReminder"
            @view-all="handleViewAllReminders"
          />
          <template #fallback>
            <RemindersSectionSkeleton />
          </template>
        </Suspense>
      </section>
    </main>
    </div>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
