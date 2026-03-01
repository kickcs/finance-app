<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import type { CategoryBreakdown } from '@/entities/transaction';
import { mapExpenseCategoryStats } from '@/features/analytics-filters';
import { TopCategories } from '@/widgets/analytics/top-categories';
import { SectionHeader, Skeleton, EmptyState, UCard } from '@/shared/ui';

const props = defineProps<{
  categoryBreakdown: CategoryBreakdown[];
  currency: string;
  loading: boolean;
  isHidden: boolean;
}>();

const router = useRouter();

const topExpenses = computed(() => mapExpenseCategoryStats(props.categoryBreakdown));

function goToAnalytics() {
  router.push({ name: ROUTE_NAMES.ANALYTICS });
}
</script>

<template>
  <div>
    <SectionHeader
      title="Расходы за месяц"
      :show-add="false"
      view-all-text="Детали"
      @view-all="goToAnalytics"
    />

    <div class="mt-3">
      <!-- Loading skeleton -->
      <UCard v-if="loading" padding="lg" variant="bordered" class="shadow-sm">
        <div class="space-y-4">
          <div v-for="i in 3" :key="i" class="space-y-2">
            <div class="flex items-center gap-3">
              <Skeleton class="w-5 h-5 rounded" />
              <Skeleton class="w-8 h-8 rounded-lg" />
              <Skeleton class="flex-1 h-4 rounded" />
              <Skeleton class="w-16 h-4 rounded" />
            </div>
            <Skeleton class="h-1.5 rounded-full" />
          </div>
        </div>
      </UCard>

      <!-- Hidden state -->
      <UCard v-else-if="isHidden" padding="lg" variant="bordered" class="shadow-sm">
        <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2">
          Данные скрыты
        </p>
      </UCard>

      <!-- Empty state -->
      <UCard v-else-if="topExpenses.length === 0" padding="lg" variant="bordered" class="shadow-sm">
        <EmptyState
          icon="category"
          title="Нет расходов"
          description="В этом месяце нет расходов"
          variant="inline"
        />
      </UCard>

      <!-- Data -->
      <TopCategories v-else :categories="topExpenses" :currency="currency" :limit="3" />
    </div>
  </div>
</template>
