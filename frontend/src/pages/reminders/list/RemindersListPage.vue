<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { ReminderCard, useReminders, type Reminder } from '@/entities/reminder';
import { UButton, UIcon, UCard, EmptyState } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// Use real data from API
const { reminders } = useReminders(userId);

// Calculate reminders due today
const todayReminders = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return reminders.value.filter((r) => {
    if (!r.next_date) return false;
    const date = new Date(r.next_date);
    return date >= today && date < tomorrow;
  });
});

// Calculate reminders due this week (excluding today)
const thisWeekReminders = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return reminders.value.filter((r) => {
    if (!r.next_date) return false;
    const date = new Date(r.next_date);
    return date >= tomorrow && date < nextWeek;
  });
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

function goBack() {
  navigateBack();
}

function handleReminderClick(reminder: Reminder) {
  router.push({ name: 'reminder-detail', params: { id: reminder.id } });
}

function handleAddReminder() {
  router.push({ name: 'new-reminder' });
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <!-- Header -->
    <AppHeader blur show-back title="Напоминания" @back="goBack">
      <template #actions>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Добавить напоминание"
          @click="handleAddReminder"
        >
          <UIcon name="add" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="px-5 pt-8 space-y-6">
      <!-- Statistics Cards -->
      <div v-if="reminders.length > 0" class="grid grid-cols-2 gap-3">
        <!-- Today count -->
        <UCard class="p-4">
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1">Сегодня</p>
          <p class="text-lg font-bold text-reminder">
            {{ todayReminders.length }}
          </p>
        </UCard>

        <!-- This week count -->
        <UCard class="p-4">
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1">
            На этой неделе
          </p>
          <p class="text-lg font-bold text-primary">
            {{ thisWeekReminders.length }}
          </p>
        </UCard>
      </div>

      <!-- Reminders List -->
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark px-1">
          Все подписки
        </h2>

        <div v-if="reminders.length > 0" class="space-y-2">
          <div v-for="reminder in reminders" :key="reminder.id" class="relative">
            <!-- Today highlight bar -->
            <div
              v-if="isDueToday(reminder)"
              class="absolute left-0 top-0 bottom-0 w-1 bg-reminder rounded-l-xl"
            />
            <ReminderCard
              :reminder="reminder"
              :currency="currency"
              :class="isDueToday(reminder) && 'bg-reminder-light'"
              @click="handleReminderClick(reminder)"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="bg-card-light dark:bg-card-dark rounded-2xl">
          <EmptyState
            icon="notifications"
            title="Нет подписок"
            description="Добавьте подписки для отслеживания регулярных платежей"
            icon-bg-class="bg-reminder-light"
            :action="{ label: 'Добавить подписку', onClick: handleAddReminder }"
          />
        </div>
      </div>
    </main>
  </div>
</template>
