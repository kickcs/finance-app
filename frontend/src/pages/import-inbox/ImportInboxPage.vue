<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { goBackOr } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useProfile } from '@/shared/api/composables/useProfile';
import { AppHeader } from '@/widgets/header';
import { EmptyState, SkeletonListItem, UIcon, UBadge } from '@/shared/ui';
import { useImportedTransactions } from '@/entities/imported-transaction';
import { useAccounts } from '@/entities/account';
import { useInboxSortOrder } from './model/useInboxSortOrder';
import { groupInboxItemsByDay } from './model/inboxGrouping';
import ImportInboxItem from './ui/ImportInboxItem.vue';
import AccountBalancesStrip from './ui/AccountBalancesStrip.vue';

const router = useRouter();
const { userId } = useCurrentUser();

const { items, isLoading } = useImportedTransactions(userId);
const { accounts } = useAccounts(userId);
const { profile } = useProfile(userId);
const hiddenAccountIds = computed<Set<string>>(
  () => new Set(profile.value?.dashboard_settings?.hidden_account_ids ?? []),
);
const { sortOrder, toggle: toggleSortOrder, sortItems } = useInboxSortOrder();

const sortedItems = computed(() => sortItems(items.value));
const groupedItems = computed(() => groupInboxItemsByDay(sortedItems.value));

function openConfirm(id: string) {
  router.push({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id } });
}

// Инбокс — это ещё и точка входа TMA (заходят сюда через `replace` без
// истории) и адрес push-уведомлений о новых импортах — тогда «назад» уводить некуда.
function goBack() {
  goBackOr({ name: ROUTE_NAMES.DASHBOARD });
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 lg:pb-8 overflow-y-auto"
  >
    <AppHeader show-back @back="goBack">
      <template #left>
        <h1 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          На подтверждение
        </h1>
        <UBadge v-if="items.length > 0" variant="primary" size="xs" shape="pill">
          {{ items.length }}
        </UBadge>
      </template>
      <template #actions>
        <button
          v-if="items.length > 1"
          type="button"
          :aria-label="
            sortOrder === 'newest' ? 'Показать сначала старые' : 'Показать сначала новые'
          "
          class="flex items-center justify-center w-8 h-8 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark active:scale-95 transition-all cursor-pointer"
          @click="toggleSortOrder"
        >
          <UIcon name="swap_vert" size="sm" />
        </button>
      </template>
    </AppHeader>

    <main class="flex-1 px-5 pt-4">
      <!-- Балансы нескрытых счетов — для сверки при разборе импортов -->
      <AccountBalancesStrip
        :accounts="accounts"
        :hidden-account-ids="hiddenAccountIds"
        class="mb-3"
      />

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="rounded-2xl bg-surface-light/50 dark:bg-surface-dark/50 divide-y divide-border-light dark:divide-border-dark overflow-hidden"
      >
        <div v-for="i in 5" :key="i" class="px-4 py-3">
          <SkeletonListItem />
        </div>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="items.length === 0"
        icon="inbox"
        title="Нет импортов на подтверждение"
        description="Перешлите сообщение от банка боту в Telegram — операция появится здесь для проверки."
      />

      <!-- List, grouped by calendar day -->
      <div v-else class="space-y-4">
        <section v-for="group in groupedItems" :key="group.label" class="space-y-1.5">
          <p class="px-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ group.label }}
          </p>
          <div
            class="rounded-2xl bg-surface-light/50 dark:bg-surface-dark/50 divide-y divide-border-light dark:divide-border-dark overflow-hidden"
          >
            <ImportInboxItem
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              @click="openConfirm(item.id)"
            />
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
