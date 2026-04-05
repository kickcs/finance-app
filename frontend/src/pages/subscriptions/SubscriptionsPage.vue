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
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import { navigateBack } from '@/app/router';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { pluralize } from '@/shared/lib/format/pluralize';

const router = useRouter();
const { trigger } = useHaptics();
const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

const { subscriptions, activeSubscriptions, totalMonthlyAmount, isLoading } =
  useRecurringSubscriptions(userId);

// Calendar month state
const currentMonth = ref(new Date());

// Sort upcoming subscriptions by billing date proximity
const upcomingSubscriptions = computed(() => {
  return [...activeSubscriptions.value].sort(
    (a, b) => daysUntilBilling(a.billing_date) - daysUntilBilling(b.billing_date),
  );
});

const pausedSubscriptions = computed(() =>
  subscriptions.value.filter((s) => s.status === 'paused'),
);

function handleAdd() {
  trigger('selection');
  router.push({ name: ROUTE_NAMES.NEW_SUBSCRIPTION });
}

function handleSubscriptionClick(id: string) {
  trigger('selection');
  router.push({ name: ROUTE_NAMES.SUBSCRIPTION_DETAIL, params: { id } });
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <!-- Header -->
    <AppHeader blur show-back title="Подписки" @back="goBack">
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

    <main class="px-5 pt-6 pb-6 space-y-6">
      <!-- Loading State -->
      <template v-if="isLoading">
        <Skeleton class="h-48 rounded-2xl" />
        <div class="space-y-3">
          <Skeleton class="h-5 w-32" />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
          <SubscriptionCardSkeleton />
        </div>
      </template>

      <template v-else>
        <!-- Monthly summary -->
        <UCard v-if="activeSubscriptions.length > 0" class="p-4" variant="bordered">
          <p
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1"
          >
            Ежемесячные расходы
          </p>
          <p class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {{ formatCurrency(totalMonthlyAmount, currency) }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
            {{ activeSubscriptions.length }}
            {{ pluralize(activeSubscriptions.length, 'подписка', 'подписки', 'подписок') }}
          </p>
        </UCard>

        <!-- Calendar -->
        <SubscriptionCalendar
          v-if="activeSubscriptions.length > 0"
          :subscriptions="activeSubscriptions"
          :current-month="currentMonth"
          :total-amount="totalMonthlyAmount"
          :currency="currency"
          @update:current-month="currentMonth = $event"
        />

        <!-- Upcoming subscriptions -->
        <div v-if="upcomingSubscriptions.length > 0" class="space-y-3">
          <h2 class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Ближайшие
          </h2>
          <div class="space-y-2">
            <SubscriptionListItem
              v-for="sub in upcomingSubscriptions"
              :key="sub.id"
              :subscription="sub"
              @click="handleSubscriptionClick(sub.id)"
            />
          </div>
        </div>

        <!-- Paused subscriptions -->
        <div v-if="pausedSubscriptions.length > 0" class="space-y-3">
          <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
            Приостановленные
          </h2>
          <div class="space-y-2">
            <SubscriptionListItem
              v-for="sub in pausedSubscriptions"
              :key="sub.id"
              :subscription="sub"
              @click="handleSubscriptionClick(sub.id)"
            />
          </div>
        </div>

        <!-- Empty State -->
        <UCard v-if="subscriptions.length === 0" class="py-8">
          <EmptyState
            icon="subscriptions"
            title="Нет подписок"
            description="Добавьте подписки, чтобы отслеживать регулярные платежи"
            icon-bg-class="bg-primary/10 text-primary"
            :action="{ label: 'Добавить подписку', onClick: handleAdd }"
          />
        </UCard>
      </template>
    </main>
  </div>
</template>
