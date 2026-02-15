<script setup lang="ts">
import { computed } from 'vue';
import {
  ReminderCard,
  ReminderCardSkeleton,
  type Reminder,
} from '@/entities/reminder';
import { UIcon, UButton } from '@/shared/ui';

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

// Check if reminder is due today
function isDueToday(reminder: Reminder): boolean {
  if (!reminder.next_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = new Date(reminder.next_date);
  return date >= today && date < tomorrow;
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
      <UButton
        v-if="reminders.length > 0"
        variant="ghost"
        size="xs"
        @click="$emit('view-all')"
      >
        <UIcon name="chevron_right" size="xs" />
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-2">
      <ReminderCardSkeleton v-for="i in 3" :key="i" :compact="true" />
    </div>

    <!-- Reminders List -->
    <div v-else-if="reminders.length > 0" class="space-y-2">
      <div
        v-for="reminder in reminders.slice(0, 5)"
        :key="reminder.id"
        class="relative"
      >
        <!-- Today highlight -->
        <div
          v-if="isDueToday(reminder)"
          class="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-primary"
        />
        <ReminderCard
          :reminder="reminder"
          :currency="currency"
          :compact="true"
          :class="isDueToday(reminder) && 'bg-primary-light'"
          @click="$emit('reminder-click', reminder)"
        />
      </div>
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
