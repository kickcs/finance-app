<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { AppHeader } from '@/widgets/header';
import { navigateBack } from '@/app/router';
import { AccountCard, type AccountWithBalances } from '@/entities/account';
import { UButton, UIcon, UCard, EmptyState, IconBadge, SectionHeader, Skeleton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';

import { useAccountsPage } from './model/useAccountsPage';

const draggable = defineAsyncComponent(() => import('vuedraggable'));

const router = useRouter();

const {
  currency,
  accounts,
  isLoading,
  totalBalance,
  localAccounts,
  handleAddAccount,
  handleDragStart,
  handleDragEnd,
} = useAccountsPage();

// Мобильный выбор счёта — отдельный маршрут, а не master-detail: URL-выбор
// нужен только десктопной версии (AccountsDesktopPage.vue).
function handleAccountClick(account: AccountWithBalances) {
  router.push({ name: ROUTE_NAMES.ACCOUNT_DETAIL, params: { id: account.id } });
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden"
  >
    <!-- Header -->
    <AppHeader title="Счета">
      <template #left>
        <UButton variant="ghost" size="sm" aria-label="Назад" @click="navigateBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
      </template>
      <template #actions>
        <UButton variant="ghost" icon-only aria-label="Добавить счёт" @click="handleAddAccount">
          <UIcon name="add" size="md" />
        </UButton>
      </template>
    </AppHeader>

    <div class="flex-1 overflow-hidden">
      <div class="mx-auto h-full px-5">
        <div class="h-full overflow-y-auto overflow-x-hidden">
          <div class="py-8 space-y-6 pb-28">
            <!-- Total Balance Card -->
            <UCard class="p-6 overflow-hidden relative" variant="bordered">
              <!-- Background decoration -->
              <div
                class="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"
              />
              <div
                class="absolute -left-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none"
              />

              <div class="relative flex items-center justify-between">
                <div class="space-y-1">
                  <p
                    class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    Общий баланс
                  </p>
                  <Skeleton v-if="isLoading" class="h-8 w-32 mt-1 rounded-lg" />
                  <p
                    v-else
                    class="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight"
                  >
                    {{ formatCurrency(totalBalance, currency) }}
                  </p>
                </div>
                <IconBadge
                  icon="account_balance_wallet"
                  size="lg"
                  color="#3b82f6"
                  class="shrink-0"
                />
              </div>
            </UCard>

            <!-- Accounts List -->
            <div class="space-y-4">
              <SectionHeader
                title="Мои счета"
                :count="!isLoading ? accounts.length : undefined"
                show-add
                @add-click="handleAddAccount"
              />

              <div v-if="isLoading" class="space-y-3">
                <Skeleton v-for="i in 3" :key="i" class="h-[88px] w-full rounded-2xl" />
              </div>

              <div v-else-if="localAccounts.length > 0" class="space-y-3">
                <draggable
                  v-model="localAccounts"
                  item-key="id"
                  handle=".drag-handle"
                  ghost-class="opacity-50"
                  animation="200"
                  class="space-y-3"
                  @start="handleDragStart"
                  @end="handleDragEnd"
                >
                  <template #item="{ element: account }">
                    <div class="flex items-center gap-3">
                      <div
                        class="drag-handle cursor-grab active:cursor-grabbing text-text-tertiary-light dark:text-text-tertiary-dark shrink-0 touch-none"
                      >
                        <UIcon name="drag_indicator" size="sm" />
                      </div>
                      <AccountCard
                        :account="account"
                        class="flex-1 transition-transform active:scale-[0.98]"
                        @click="handleAccountClick(account)"
                      />
                    </div>
                  </template>
                </draggable>
              </div>

              <!-- Empty State -->
              <UCard v-else class="py-4" data-testid="accounts-empty-state">
                <EmptyState
                  icon="account_balance_wallet"
                  title="У вас пока нет счетов"
                  description="Добавьте свой первый счет для учета финансов"
                  :action="{ label: 'Создать счёт', onClick: handleAddAccount }"
                />
              </UCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
