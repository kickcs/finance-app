<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { AppHeader } from '@/widgets/header';
import {
  SubscriptionCalendar,
  SubscriptionListItem,
  SubscriptionCardSkeleton,
  useRecurringSubscriptions,
  daysUntilBilling,
} from '@/entities/recurring-subscription';
import { UButton, UIcon, EmptyState, UCard, Skeleton } from '@/shared/ui';
import { SearchInput } from '@/features/search-transactions';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import { navigateBack } from '@/app/router';
import { formatNumberWithSpaces, formatCurrency } from '@/shared/lib/format/currency';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const { trigger } = useHaptics();
const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

const { subscriptions, activeSubscriptions, totalMonthlyAmount, isLoading } =
  useRecurringSubscriptions(userId, currency);

const currentMonth = ref(new Date());
const search = ref('');

const normalizedSearch = computed(() => search.value.toLowerCase().trim());
const matchesSearch = (name: string) =>
  !normalizedSearch.value || name.toLowerCase().includes(normalizedSearch.value);

const upcomingSubscriptions = computed(() =>
  [...activeSubscriptions.value]
    .filter((s) => matchesSearch(s.name))
    .sort((a, b) => daysUntilBilling(a.billing_date) - daysUntilBilling(b.billing_date)),
);

const pausedSubscriptions = computed(() =>
  subscriptions.value.filter((s) => s.status === 'paused' && matchesSearch(s.name)),
);

const hasResults = computed(
  () => upcomingSubscriptions.value.length + pausedSubscriptions.value.length > 0,
);

const yearlyAmount = computed(() => totalMonthlyAmount.value * 12);

function handleAdd() {
  trigger('selection');
  router.push({ name: ROUTE_NAMES.NEW_SUBSCRIPTION });
}

function handleSubscriptionClick(id: string) {
  trigger('selection');
  router.push({ name: ROUTE_NAMES.SUBSCRIPTION_DETAIL, params: { id } });
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <AppHeader blur show-back title="Подписки" @back="navigateBack">
      <template #actions>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Добавить подписку"
          @click="handleAdd"
        >
          <UIcon name="add" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <main class="px-5 pt-5 pb-6 space-y-6">
      <template v-if="isLoading">
        <Skeleton class="h-24 rounded-2xl" />
        <Skeleton class="h-11 rounded-xl" />
        <div class="space-y-3">
          <Skeleton class="h-4 w-24" />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      </template>

      <template v-else-if="subscriptions.length === 0">
        <UCard class="py-8">
          <EmptyState
            icon="subscriptions"
            title="Нет подписок"
            description="Добавьте подписки, чтобы отслеживать регулярные платежи"
            icon-bg-class="bg-primary/10 text-primary"
            :action="{ label: 'Добавить подписку', onClick: handleAdd }"
          />
        </UCard>
      </template>

      <template v-else>
        <!-- Hero summary — minimal, no glow -->
        <section class="flex items-end gap-3 px-1">
          <div class="flex items-baseline gap-2 min-w-0">
            <span
              class="text-[44px] font-bold tracking-[-0.035em] leading-none tabular-nums text-text-primary-light dark:text-text-primary-dark"
            >
              {{ formatNumberWithSpaces(totalMonthlyAmount) }}
            </span>
            <span
              class="text-base font-semibold text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ currency }}
            </span>
          </div>
          <div
            class="ml-auto flex flex-col items-end leading-tight text-[11.5px] text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            <span>в месяц · {{ activeSubscriptions.length }} активн.</span>
            <span
              class="font-semibold tabular-nums text-text-secondary-light dark:text-text-secondary-dark"
            >
              ≈ {{ formatCurrency(yearlyAmount, currency) }} / год
            </span>
          </div>
        </section>

        <!-- Search -->
        <SearchInput v-model="search" placeholder="Поиск подписки" @clear="search = ''" />

        <!-- Calendar -->
        <SubscriptionCalendar
          v-if="activeSubscriptions.length > 0 && !search"
          :subscriptions="activeSubscriptions"
          :current-month="currentMonth"
          :total-amount="totalMonthlyAmount"
          :currency="currency"
          @update:current-month="currentMonth = $event"
        />

        <!-- No search results -->
        <template v-if="search && !hasResults">
          <UCard class="py-6">
            <EmptyState
              variant="inline"
              icon="search"
              title="Ничего не найдено"
              :description="`По запросу «${search}» нет подписок`"
            />
          </UCard>
        </template>

        <!-- Upcoming -->
        <section v-if="upcomingSubscriptions.length > 0" class="space-y-3">
          <header class="flex items-center justify-between px-1">
            <h2
              class="text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary-light dark:text-text-secondary-dark"
            >
              Ближайшие
            </h2>
            <span
              class="text-[11px] font-bold tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ upcomingSubscriptions.length }}
            </span>
          </header>
          <div class="flex flex-col gap-2">
            <SubscriptionListItem
              v-for="sub in upcomingSubscriptions"
              :key="sub.id"
              :subscription="sub"
              @click="handleSubscriptionClick(sub.id)"
            />
          </div>
        </section>

        <!-- Paused -->
        <section v-if="pausedSubscriptions.length > 0" class="space-y-3">
          <header class="flex items-center justify-between px-1">
            <h2
              class="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              Приостановленные
            </h2>
            <span
              class="text-[11px] font-bold tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ pausedSubscriptions.length }}
            </span>
          </header>
          <div class="flex flex-col gap-2">
            <SubscriptionListItem
              v-for="sub in pausedSubscriptions"
              :key="sub.id"
              :subscription="sub"
              @click="handleSubscriptionClick(sub.id)"
            />
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
