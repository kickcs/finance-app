<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { AppHeader } from '@/widgets/header';
import { EmptyState, SkeletonListItem } from '@/shared/ui';
import { useImportedTransactions } from '@/entities/imported-transaction';
import ImportInboxItem from './ui/ImportInboxItem.vue';

const router = useRouter();
const { userId } = useCurrentUser();

const { items, isLoading } = useImportedTransactions(userId);

function openConfirm(id: string) {
  router.push({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id } });
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <AppHeader title="На подтверждение" show-back @back="navigateBack" />

    <main class="flex-1 px-5 pt-4">
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
        description="Перешлите сообщение от банка боту в Telegram — операции появятся здесь для проверки и подтверждения."
      />

      <!-- List -->
      <div
        v-else
        class="rounded-2xl bg-surface-light/50 dark:bg-surface-dark/50 divide-y divide-border-light dark:divide-border-dark overflow-hidden"
      >
        <ImportInboxItem
          v-for="item in items"
          :key="item.id"
          :item="item"
          @click="openConfirm(item.id)"
        />
      </div>
    </main>
  </div>
</template>
