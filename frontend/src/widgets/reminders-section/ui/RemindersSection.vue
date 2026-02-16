<script setup lang="ts">
import { computed } from 'vue';
import {
  ReminderCardSkeleton,
  type Reminder,
} from '@/entities/reminder';
import { UIcon, UButton } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  reminders: Reminder[];
  currency: string;
  loading?: boolean;
}>();

defineEmits<{
  'reminder-click': [reminder: Reminder];
  'add-click': [];
  'view-all': [];
}>();

// Count reminders due today
const todayCount = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return props.reminders.filter((r) => {
    if (!r.next_date) return false;
    const date = new Date(r.next_date);
    return date >= today && date < tomorrow;
  }).length;
});

function isUpcoming(reminder: Reminder): boolean {
  const nextDateMs = new Date(reminder.next_date).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return nextDateMs - Date.now() < threeDays && nextDateMs > Date.now();
}

function isOverdue(reminder: Reminder): boolean {
  return new Date(reminder.next_date).getTime() < Date.now();
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Подписки
        </h2>
        <span
          v-if="todayCount > 0"
          class="px-1.5 py-0.5 text-xs font-semibold rounded-md bg-primary text-white"
        >
          {{ todayCount }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <UButton variant="ghost" size="xs" @click="$emit('add-click')">
          <UIcon name="add" size="xs" />
        </UButton>
        <UButton
          v-if="reminders.length > 0"
          variant="ghost"
          size="xs"
          @click="$emit('view-all')"
        >
          Все
          <UIcon name="chevron_right" size="xs" />
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex gap-3 overflow-hidden">
      <div
        v-for="i in 3"
        :key="i"
        class="shrink-0 w-36 h-28 rounded-xl bg-surface-light dark:bg-surface-dark animate-shimmer"
      />
    </div>

    <!-- Horizontal scroll list -->
    <div
      v-else-if="reminders.length > 0"
      class="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1"
    >
      <button
        v-for="reminder in reminders.slice(0, 8)"
        :key="reminder.id"
        class="shrink-0 w-36 p-3 rounded-xl text-left bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :aria-label="`${reminder.name}, ${formatCurrency(reminder.amount, currency || 'UZS')}`"
        @click="$emit('reminder-click', reminder)"
      >
        <!-- Icon -->
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5"
          :class="[
            isOverdue(reminder)
              ? 'bg-danger/10'
              : isUpcoming(reminder)
                ? 'bg-warning/10'
                : 'bg-surface-light dark:bg-surface-dark',
          ]"
        >
          <UIcon
            :name="reminder.icon"
            size="md"
            :class="[
              isOverdue(reminder)
                ? 'text-danger'
                : isUpcoming(reminder)
                  ? 'text-warning'
                  : 'text-text-secondary-light dark:text-text-secondary-dark',
            ]"
          />
        </div>

        <!-- Name -->
        <p
          class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate mb-0.5"
        >
          {{ reminder.name }}
        </p>

        <!-- Amount -->
        <p class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ formatCurrency(reminder.amount, currency || 'UZS', COMPACT_FORMAT) }}
        </p>
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="py-8 text-center rounded-xl border border-border-light dark:border-border-dark border-dashed"
    >
      <div
        class="w-10 h-10 mx-auto mb-2 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center"
      >
        <UIcon
          name="notifications"
          size="md"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </div>
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-0.5"
      >
        Нет подписок
      </p>
      <p
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-3"
      >
        Добавьте для отслеживания платежей
      </p>
      <UButton variant="secondary" size="xs" @click="$emit('add-click')">
        <UIcon name="add" size="xs" class="mr-0.5" />
        Добавить
      </UButton>
    </div>
  </div>
</template>
