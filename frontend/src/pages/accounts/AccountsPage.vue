<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useScroll } from '@vueuse/core';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { AppHeader } from '@/widgets/header';
import { navigateBack } from '@/app/router';
import { AccountCard, type AccountWithBalances } from '@/entities/account';
import {
  UButton,
  UIcon,
  UCard,
  EmptyState,
  IconBadge,
  PullToRefresh,
  SectionHeader,
  Skeleton,
} from '@/shared/ui';
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
  handleRefresh,
  moveAccount,
} = useAccountsPage();

/**
 * Один-единственный скролл-контейнер на страницу: горизонтальные отступы живут
 * ВНУТРИ него, иначе системный скроллбар отрисовывается в 20px от края и едет
 * прямо поверх карточек.
 *
 * Тот же элемент отдаём PullToRefresh (ему нужен настоящий скроллер, чтобы
 * отличать «тянут вниз от самого верха» от обычной прокрутки) и useScroll —
 * по нему шапка понимает, уехал ли под неё контент.
 */
const scrollRef = ref<HTMLElement | null>(null);
const { y: scrollY } = useScroll(scrollRef);
const isScrolled = computed(() => scrollY.value > 8);

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
    <AppHeader
      title="Счета"
      blur
      class="shrink-0 border-b"
      :class="isScrolled ? 'border-border-light dark:border-border-dark' : 'border-transparent'"
    >
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

    <!-- Растворяем контент под шапкой вместо резкого среза на её границе.
         Лежит в потоке (h-6 + -mb-6), поэтому не зависит от высоты шапки и
         не сдвигает <main>. -->
    <div
      class="relative z-20 h-6 -mb-6 shrink-0 pointer-events-none bg-gradient-to-b from-background-light dark:from-background-dark to-transparent transition-opacity duration-200"
      :class="isScrolled ? 'opacity-100' : 'opacity-0'"
    />

    <!-- Content -->
    <main
      ref="scrollRef"
      class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar [-webkit-overflow-scrolling:touch]"
    >
      <PullToRefresh :on-refresh="handleRefresh" :container-ref="scrollRef">
        <div class="px-5 pt-6 pb-[calc(7rem+var(--safe-area-inset-bottom))] space-y-6">
          <!-- Total Balance Card -->
          <UCard class="p-5 overflow-hidden relative" variant="bordered">
            <!-- Background decoration -->
            <div
              class="absolute -right-6 -top-6 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"
            />
            <div
              class="absolute -left-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none"
            />

            <div class="relative flex items-center justify-between gap-4">
              <div class="min-w-0 space-y-1">
                <p
                  class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Общий баланс
                </p>
                <Skeleton v-if="isLoading" class="h-9 w-40 mt-1 rounded-lg" />
                <!-- Крупные суммы не режем многоточием: перенос по словам
                     оставляет их читаемыми целиком, а tabular-nums не даёт
                     цифрам прыгать при пересчёте курса. -->
                <p
                  v-else
                  class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight tabular-nums leading-snug break-words"
                >
                  {{ formatCurrency(totalBalance, currency) }}
                </p>
              </div>
              <IconBadge icon="account_balance_wallet" size="lg" color="#3b82f6" class="shrink-0" />
            </div>
          </UCard>

          <!-- Accounts List -->
          <div class="space-y-4">
            <SectionHeader
              title="Мои счета"
              :count="!isLoading ? accounts.length : undefined"
              show-add
              :show-view-all="false"
              @add-click="handleAddAccount"
            />

            <div v-if="isLoading" class="space-y-3">
              <Skeleton v-for="i in 3" :key="i" class="h-[76px] w-full rounded-xl" />
            </div>

            <!-- Ручка перетаскивания переехала ВНУТРЬ карточки: снаружи она
                 забирала у каждой строки ~28px ширины (из-за чего названия
                 счетов обрезались раньше времени) и висела отдельным элементом
                 рядом с карточкой. Комментарии держим за пределами
                 <draggable> — в его слотах должно быть ровно по одному узлу. -->
            <div v-else-if="localAccounts.length > 0">
              <draggable
                v-model="localAccounts"
                item-key="id"
                handle=".drag-handle"
                ghost-class="opacity-40"
                animation="200"
                class="space-y-3"
                @start="handleDragStart"
                @end="handleDragEnd"
              >
                <template #item="{ element: account }">
                  <div
                    class="flex items-stretch rounded-xl overflow-hidden bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-[background-color,transform] duration-150 active:scale-[0.99]"
                  >
                    <button
                      type="button"
                      class="drag-handle shrink-0 flex items-center pl-2 pr-0.5 touch-none cursor-grab active:cursor-grabbing text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      :aria-label="`Переместить счёт «${account.name}». Стрелки вверх и вниз меняют порядок`"
                      @keydown.up.prevent="moveAccount(account.id, -1)"
                      @keydown.down.prevent="moveAccount(account.id, 1)"
                    >
                      <UIcon name="drag_indicator" size="sm" />
                    </button>

                    <AccountCard
                      :account="account"
                      class="flex-1 min-w-0 !bg-transparent !border-0 !rounded-none !pl-2"
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
      </PullToRefresh>
    </main>
  </div>
</template>
