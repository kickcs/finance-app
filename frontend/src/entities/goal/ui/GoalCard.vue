<script setup lang="ts">
import { computed } from 'vue'
import { UIcon, UProgressBar } from '@/shared/ui'
import { formatCurrency } from '@/shared/lib/format/currency'
import type { Goal } from '../model/types'

const props = defineProps<{
  goal: Goal
  currency?: string
  compact?: boolean
}>()

defineEmits<{
  click: []
}>()

const progress = computed(() => {
  if (props.goal.target_amount === 0) return 0
  return Math.min((props.goal.current_amount / props.goal.target_amount) * 100, 100)
})

const remaining = computed(() => {
  return Math.max(props.goal.target_amount - props.goal.current_amount, 0)
})

const daysLeft = computed(() => {
  if (!props.goal.deadline) return null
  const now = Date.now()
  const deadlineMs = new Date(props.goal.deadline).getTime()
  const diff = deadlineMs - now
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0)
})
</script>

<template>
  <button
    :class="[
      'w-full text-left rounded-2xl transition-all duration-200',
      'hover:scale-[1.01] active:scale-[0.99]',
      'bg-card-light dark:bg-card-dark',
      'border border-gray-100 dark:border-gray-800',
      compact ? 'p-3' : 'p-4',
    ]"
    @click="$emit('click')"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <div
        class="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        :style="{
          backgroundColor: `${goal.color}20`,
        }"
      >
        <UIcon
          :name="goal.icon"
          size="md"
          :style="{ color: goal.color }"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2 mb-1">
          <p class="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ goal.name }}
          </p>
          <span
            v-if="daysLeft !== null"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
          >
            {{ daysLeft }} дн.
          </span>
        </div>

        <!-- Progress Bar -->
        <UProgressBar
          :value="progress"
          :color="goal.color"
          size="sm"
          class="mb-2"
        />

        <!-- Amount Info -->
        <div class="flex items-center justify-between text-sm">
          <span class="text-text-secondary-light dark:text-text-secondary-dark">
            {{ formatCurrency(goal.current_amount, currency || 'UZS') }}
          </span>
          <span class="text-text-tertiary-light dark:text-text-tertiary-dark">
            из {{ formatCurrency(goal.target_amount, currency || 'UZS') }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>
