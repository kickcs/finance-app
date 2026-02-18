<script setup lang="ts">
import { computed } from 'vue';
import { GoalCard, type Goal } from '@/entities/goal';
import { UIcon, UButton } from '@/shared/ui';

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
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg bg-goal-light flex items-center justify-center"
        >
          <UIcon name="flag" size="sm" class="text-goal" />
        </div>
        <h2
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Цели
        </h2>
        <!-- Goals count -->
        <span
          v-if="goals.length > 0"
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-goal-light text-goal-text dark:text-goal-text-dark"
        >
          {{ goals.length }}
        </span>
      </div>
      <UButton
        v-if="goals.length > 0"
        variant="ghost"
        size="sm"
        class="hover:bg-goal-light hover:text-goal-text transition-colors"
        @click="$emit('view-all')"
      >
        Все
        <UIcon name="chevron_right" size="sm" />
      </UButton>
    </div>

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
      <div
        v-for="i in 2"
        :key="i"
        class="h-24 rounded-2xl bg-surface-light dark:bg-surface-dark animate-shimmer"
      />
    </div>

    <!-- Goals List -->
    <div v-else-if="goals.length > 0" class="space-y-2">
      <div v-for="(goal, index) in goals.slice(0, 3)" :key="goal.id">
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

    <!-- Empty state - Minimal -->
    <div
      v-else
      class="py-8 text-center rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark"
    >
      <div>
        <div
          class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-goal-light flex items-center justify-center ring-1 ring-goal/20"
        >
          <UIcon name="flag" size="lg" class="text-goal" />
        </div>
        <p
          class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1"
        >
          Поставьте финансовую цель
        </p>
        <p
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-4"
        >
          Копите на мечту шаг за шагом
        </p>
        <UButton
          variant="primary"
          size="sm"
          class="bg-goal hover:bg-goal-text shadow-lg shadow-goal/25 hover:shadow-xl hover:shadow-goal/30 hover:scale-105 active:scale-95 transition-all duration-200"
          @click="$emit('add-click')"
        >
          <UIcon name="add" size="sm" class="mr-1" />
          Добавить цель
        </UButton>
      </div>
    </div>
  </div>
</template>
