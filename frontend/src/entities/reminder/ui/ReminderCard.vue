<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import type { Reminder } from '../model/types';
import { FREQUENCY_LABELS } from '../model/types';

const props = defineProps<{
  reminder: Reminder;
  currency?: string;
  compact?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const nextDateFormatted = computed(() => {
  return formatDate(new Date(props.reminder.next_date).getTime(), {
    format: 'short',
  });
});

const isUpcoming = computed(() => {
  const nextDateMs = new Date(props.reminder.next_date).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return nextDateMs - Date.now() < threeDays && nextDateMs > Date.now();
});

const isOverdue = computed(() => {
  return new Date(props.reminder.next_date).getTime() < Date.now();
});
</script>

<template>
  <button
    :class="[
      'w-full flex items-center gap-2.5 rounded-lg transition-all duration-200',
      'hover:bg-surface-light dark:hover:bg-surface-dark',
      'active:scale-[0.99]',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
      compact ? 'p-2' : 'p-2.5',
    ]"
    :aria-label="`${reminder.name}, ${formatCurrency(reminder.amount, currency || 'UZS')}, ${nextDateFormatted}`"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div
      class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
      :class="[
        isOverdue
          ? 'bg-danger/10'
          : isUpcoming
            ? 'bg-warning/10'
            : 'bg-surface-light dark:bg-surface-dark',
      ]"
    >
      <UIcon
        :name="reminder.icon"
        size="sm"
        :class="[
          isOverdue
            ? 'text-danger'
            : isUpcoming
              ? 'text-warning'
              : 'text-text-secondary-light dark:text-text-secondary-dark',
        ]"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 text-left min-w-0">
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
        {{ reminder.name }}
      </p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ FREQUENCY_LABELS[reminder.frequency] }}
      </p>
    </div>

    <!-- Right side -->
    <div class="text-right shrink-0">
      <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ formatCurrency(reminder.amount, currency || 'UZS') }}
      </p>
      <p
        class="text-xs"
        :class="[
          isOverdue
            ? 'text-danger'
            : isUpcoming
              ? 'text-warning'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark',
        ]"
      >
        {{ nextDateFormatted }}
      </p>
    </div>
  </button>
</template>
