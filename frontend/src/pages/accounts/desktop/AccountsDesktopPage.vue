<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DesktopPage, DesktopColumns } from '@/shared/ui/desktop-page';
import { UButton, UIcon, UCard, IconBadge, SectionHeader, Skeleton, EmptyState } from '@/shared/ui';
import { AccountCard, AccountDetailPanel } from '@/entities/account';
import { EditAccountDrawer, DeleteAccountModal } from '@/features/edit-account';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '@/entities/account';

import { useAccountsPage } from '../model/useAccountsPage';

const route = useRoute();
const router = useRouter();

// Выбор счёта живёт в URL, а не в локальном ref — перезагрузка и прямая ссылка
// сохраняют выбранный счёт (в отличие от мобильного `/accounts/:id`, где выбор
// это отдельный маршрут).
const selectedId = computed(() => (route.query.id as string | undefined) ?? null);

// Тот же ленивый импорт, что и на мобильной странице: библиотека нужна только
// когда счета уже отрисованы.
const draggable = defineAsyncComponent(() => import('vuedraggable'));

const {
  userId,
  currency,
  accounts,
  isLoading,
  totalBalance,
  creditCardDebt,
  localAccounts,
  handleDragStart,
  handleDragEnd,
  selectedAccount,
  showEditAccountModal,
  showDeleteAccountModal,
  isUpdatingAccount,
  isDeletingAccount,
  accountError,
  accountTransactionsCount,
  isLoadingTransactionsCount,
  handleAddAccount,
  openEditModal,
  openDeleteModal,
  handleUpdateAccount,
  handleDeleteAccount,
} = useAccountsPage(selectedId);

function selectAccount(account: AccountWithBalances) {
  router.replace({ query: { ...route.query, id: account.id } });
}

async function onDeleteConfirm() {
  const deletedId = selectedAccount.value?.id;
  const success = await handleDeleteAccount();
  // Удалённый счёт больше не должен оставаться выбранным в URL, иначе
  // правая колонка попытается открыть панель для несуществующего id.
  if (success && deletedId && selectedId.value === deletedId) {
    const { id: _removed, ...rest } = route.query;
    router.replace({ query: rest });
  }
}
</script>

<template>
  <DesktopPage title="Счета">
    <template #header-actions>
      <UButton variant="ghost" icon-only aria-label="Добавить счёт" @click="handleAddAccount">
        <UIcon name="add" size="md" />
      </UButton>
    </template>

    <UCard class="p-6 overflow-hidden relative mb-6" variant="bordered">
      <div
        class="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"
      />
      <div class="relative flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Общий баланс
          </p>
          <Skeleton v-if="isLoading" class="h-8 w-32 mt-1 rounded-lg" />
          <p
            v-else
            class="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight"
          >
            {{ formatCurrency(totalBalance, currency) }}
          </p>
          <p
            v-if="!isLoading && creditCardDebt > 0"
            data-testid="credit-card-debt-line"
            class="text-xs text-danger tabular-nums"
          >
            в т.ч. долг по картам −{{ formatCurrency(creditCardDebt, currency) }}
          </p>
        </div>
        <IconBadge icon="account_balance_wallet" size="lg" color="#3b82f6" class="shrink-0" />
      </div>
    </UCard>

    <DesktopColumns>
      <template #main>
        <div data-testid="accounts-desktop-list">
          <SectionHeader
            title="Мои счета"
            :count="!isLoading ? accounts.length : undefined"
            show-add
            @add-click="handleAddAccount"
          />

          <div v-if="isLoading" class="mt-3 grid grid-cols-2 gap-3">
            <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-2xl" />
          </div>

          <!-- Порядок счетов перетаскивается и здесь: на телефоне это давно
               есть, и терять функцию на широком экране было бы странно. Ручка
               не нужна — мышью тащат саму карточку, а `delay` отличает
               перетаскивание от обычного клика по счёту. -->
          <draggable
            v-else-if="accounts.length > 0"
            v-model="localAccounts"
            item-key="id"
            :animation="200"
            :delay="120"
            class="mt-3 grid grid-cols-2 gap-3"
            @start="handleDragStart"
            @end="handleDragEnd"
          >
            <template #item="{ element: account }">
              <AccountCard
                data-testid="account-row"
                :account="account"
                :class="[
                  'transition-transform cursor-grab active:cursor-grabbing',
                  selectedId === account.id &&
                    'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark',
                ]"
                @click="selectAccount(account)"
              />
            </template>
          </draggable>

          <UCard v-else class="py-4 mt-3">
            <EmptyState
              icon="account_balance_wallet"
              title="У вас пока нет счетов"
              description="Добавьте свой первый счет для учета финансов"
              :action="{ label: 'Создать счёт', onClick: handleAddAccount }"
            />
          </UCard>
        </div>
      </template>

      <template #aside>
        <div v-if="!selectedAccount" data-testid="accounts-detail-empty">
          <UCard class="py-12" variant="bordered">
            <EmptyState
              icon="account_balance_wallet"
              title="Выберите счёт"
              description="Нажмите на счёт слева, чтобы увидеть детали и транзакции"
            />
          </UCard>
        </div>

        <AccountDetailPanel
          v-else-if="userId"
          :key="selectedAccount.id"
          :account-id="selectedAccount.id"
          :user-id="userId"
          @edit="openEditModal"
          @delete="openDeleteModal"
        />
      </template>
    </DesktopColumns>
  </DesktopPage>

  <!-- Edit Account Drawer -->
  <EditAccountDrawer
    v-model="showEditAccountModal"
    :account="selectedAccount"
    :is-updating="isUpdatingAccount"
    @confirm="handleUpdateAccount"
  />

  <!-- Delete Account Modal -->
  <DeleteAccountModal
    v-model="showDeleteAccountModal"
    :account="selectedAccount"
    :transactions-count="accountTransactionsCount ?? 0"
    :is-loading-count="isLoadingTransactionsCount"
    :currency="currency"
    :is-deleting="isDeletingAccount"
    :error="accountError"
    @confirm="onDeleteConfirm"
  />
</template>
