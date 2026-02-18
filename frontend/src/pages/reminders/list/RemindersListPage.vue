<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BottomNav } from '@/widgets/bottom-nav';
import { AppHeader } from '@/widgets/header';
import { ReminderCard, useReminders, type Reminder } from '@/entities/reminder';
import { UButton, UIcon, UCard } from '@/shared/ui';
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

// Calculate reminders due this week
const thisWeekReminders = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return reminders.value.filter((r) => {
    if (!r.next_date) return false;
    const date = new Date(r.next_date);
    return date >= today && date < nextWeek;
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

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader blur show-back title="Напоминания" @back="goBack">
      <template #actions>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
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
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
          >
            Сегодня
          </p>
          <p class="text-lg font-bold text-reminder">
            {{ todayReminders.length }}
          </p>
        </UCard>

        <!-- This week count -->
        <UCard class="p-4">
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
          >
            На этой неделе
          </p>
          <p class="text-lg font-bold text-blue-500">
            {{ thisWeekReminders.length }}
          </p>
        </UCard>
      </div>

      <!-- Reminders List -->
      <div class="space-y-3">
        <h2
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark px-1"
        >
          Все подписки
        </h2>

        <div v-if="reminders.length > 0" class="space-y-2">
          <div
            v-for="reminder in reminders"
            :key="reminder.id"
            class="relative"
          >
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
        <div
          v-else
          class="py-12 text-center bg-card-light dark:bg-card-dark rounded-2xl"
        >
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-full bg-reminder-light flex items-center justify-center"
          >
            <UIcon name="notifications" size="lg" class="text-reminder" />
          </div>
          <p
            class="text-text-secondary-light dark:text-text-secondary-dark mb-4 font-semibold"
          >
            Нет подписок
          </p>
          <p
            class="text-text-tertiary-light dark:text-text-tertiary-dark mb-4 text-sm"
          >
            Добавьте подписки для отслеживания регулярных платежей
          </p>
          <UButton variant="primary" @click="handleAddReminder">
            <UIcon name="add" size="sm" class="mr-1" />
            Добавить подписку
          </UButton>
        </div>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
