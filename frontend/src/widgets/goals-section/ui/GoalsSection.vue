<script setup lang="ts">
import { computed } from 'vue';
import { GoalCard, type Goal } from '@/entities/goal';
import { SectionHeader, IconBadge, EmptyState, Skeleton } from '@/shared/ui';

const props = defineProps<{
  goals: Goal[];
  currency: string;
  loading?: boolean;
}>();

defineEmits<{
  'goal-click': [goal: Goal];
  'add-click': [];
  'view-all': [];
}>();

// Calculate overall progress
const overallProgress = computed(() => {
  if (props.goals.length === 0) return 0;
  const totalTarget = props.goals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalCurrent = props.goals.reduce(
    (sum, g) => sum + g.current_amount,
    0,
  );
  return totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
});

// Check if goal is near completion (>90%)
function isNearCompletion(goal: Goal): boolean {
  return (
    goal.target_amount > 0 && goal.current_amount / goal.target_amount >= 0.9
  );
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header with icon -->
    <SectionHeader
      title="Цели"
      :count="goals.length"
      @add-click="$emit('add-click')"
      @view-all="$emit('view-all')"
    >
      <template #icon>
        <IconBadge
          icon="flag"
          size="xs"
          bg-class="bg-goal-light"
          icon-class="text-goal-text dark:text-goal-text-dark"
        />
      </template>
    </SectionHeader>

    <!-- Overall progress summary -->
    <div
      v-if="goals.length > 0 && !loading"
      class="flex items-center gap-3 px-4 py-3 rounded-xl bg-goal-light/50 border border-goal/10"
    >
      <div class="flex-1">
        <div class="flex items-center justify-between mb-1.5">
          <span
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Общий прогресс
          </span>
          <span
            class="text-xs font-bold text-goal-text dark:text-goal-text-dark"
          >
            {{ overallProgress }}%
          </span>
        </div>
        <div
          class="h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden"
        >
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{
              width: `${overallProgress}%`,
              background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
            }"
          />
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 2" :key="i" class="h-24 rounded-2xl" />
    </div>

    <!-- Goals List -->
    <div v-else-if="goals.length > 0" class="space-y-2">
      <div v-for="goal in goals.slice(0, 3)" :key="goal.id">
        <GoalCard
          :goal="goal"
          :currency="currency"
          :class="[
            isNearCompletion(goal) &&
              'ring-2 ring-goal/50 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark',
          ]"
          @click="$emit('goal-click', goal)"
        />
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      variant="inline"
      icon="flag"
      title="Поставьте финансовую цель"
      description="Копите на мечту шаг за шагом"
      icon-bg-class="bg-goal-light"
      :action="{ label: 'Добавить цель', onClick: () => $emit('add-click') }"
    />
  </div>
</template>
