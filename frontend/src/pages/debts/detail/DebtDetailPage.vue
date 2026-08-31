<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { UButton, UIcon } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import { useDebts, type Debt } from '@/entities/debt';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useDebtDetail } from '../model/useDebtDetail';
import DebtDetailBody from './DebtDetailBody.vue';
import DebtDetailOverlays from './DebtDetailOverlays.vue';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();

const debtId = computed(() => route.params.id as string);
const { debts, isLoading } = useDebts(userId);
const debt = computed<Debt | null>(() => debts.value.find((d) => d.id === debtId.value) ?? null);

const { title, openEdit, openActions } = useDebtDetail({
  debt,
  isLoading,
  // Долг закрылся или удалён — смотреть больше нечего. Фильтр списка приезжает
  // в адресе вместе с переходом сюда и уходит обратно тем же путём, поэтому
  // человек возвращается к тому же списку, из которого пришёл.
  onGone: () => router.replace({ name: ROUTE_NAMES.DEBTS_LIST, query: route.query }),
});

function goBack() {
  navigateBack();
}
</script>

<template>
  <div
    class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark relative"
  >
    <AppHeader :title="title" show-back blur @back="goBack">
      <template v-if="debt" #actions>
        <UButton
          v-if="!debt.is_closed"
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Редактировать"
          @click="openEdit"
        >
          <UIcon name="edit" size="sm" />
        </UButton>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Ещё"
          data-testid="debt-more-btn"
          @click="openActions"
        >
          <UIcon name="more_horiz" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <main class="flex-1 overflow-y-auto">
      <div class="px-5 pt-4 pb-28">
        <DebtDetailBody />
      </div>
    </main>

    <DebtDetailOverlays />
  </div>
</template>
