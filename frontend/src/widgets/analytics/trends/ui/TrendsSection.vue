<script setup lang="ts">
import { computed, ref } from 'vue';
import { UCard, UTabs } from '@/shared/ui';
import DailyExpenseChart from '../../daily-expense-chart/ui/DailyExpenseChart.vue';
import PeriodComparison from '../../period-comparison/ui/PeriodComparison.vue';

const props = defineProps<{
  entries: { date: string; expense: number }[];
  groupBy: 'day' | 'week' | 'month';
  currentExpense: number;
  previousExpense: number;
  currentIncome: number;
  previousIncome: number;
  currentSavingsRate: number;
  previousSavingsRate: number;
  currency: string;
  chartLoading?: boolean;
  comparisonLoading?: boolean;
  noComparisonData?: boolean;
}>();

const activeTab = ref<'chart' | 'comparison'>('chart');

const chartLabel = computed(() => {
  switch (props.groupBy) {
    case 'week':
      return 'По неделям';
    case 'month':
      return 'По месяцам';
    default:
      return 'По дням';
  }
});

const items = computed(() => [
  { id: 'chart', label: chartLabel.value },
  { id: 'comparison', label: 'Сравнение' },
]);
</script>

<template>
  <!-- Секция при первой отрисовке заведомо ниже сгиба, поэтому её рендер
       откладывается до прокрутки. Резерв высоты держит скроллбар стабильным. -->
  <UCard padding="md" class="[content-visibility:auto] [contain-intrinsic-size:auto_280px]">
    <UTabs
      :model-value="activeTab"
      :items="items"
      size="sm"
      class="mb-3"
      @update:model-value="activeTab = $event as 'chart' | 'comparison'"
    />

    <KeepAlive>
      <DailyExpenseChart
        v-if="activeTab === 'chart'"
        :entries="entries"
        :currency="currency"
        :loading="chartLoading"
        :group-by="groupBy"
      />
      <PeriodComparison
        v-else
        :current-expense="currentExpense"
        :previous-expense="previousExpense"
        :current-income="currentIncome"
        :previous-income="previousIncome"
        :current-savings-rate="currentSavingsRate"
        :previous-savings-rate="previousSavingsRate"
        :currency="currency"
        :loading="comparisonLoading"
        :no-data="noComparisonData"
      />
    </KeepAlive>
  </UCard>
</template>
