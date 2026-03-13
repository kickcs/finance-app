<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { AppHeader } from '@/widgets/header';
import {
  ReminderCard,
  ReminderDetailPanel,
  useReminders,
  type Reminder,
} from '@/entities/reminder';
import { EditReminderModal, DeleteReminderModal, useEditReminder } from '@/features/edit-reminder';
import { UButton, UIcon, UCard, EmptyState, MasterDetailLayout } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const router = useRouter();
const isDesktop = useIsDesktop();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// Use real data from API
const { reminders } = useReminders(userId);

// Selected reminder for desktop detail panel
const selectedReminderId = ref<string | null>(null);

// Find selected reminder for detail panel modals
const selectedReminder = computed<Reminder | null>(() => {
  if (!selectedReminderId.value) return null;
  return reminders.value.find((r) => r.id === selectedReminderId.value) ?? null;
});

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

// Set of today's reminder IDs for O(1) lookups
const todayReminderIds = computed(() => new Set(todayReminders.value.map((r) => r.id)));

function isDueToday(reminder: Reminder): boolean {
  return todayReminderIds.value.has(reminder.id);
}

function goBack() {
  navigateBack();
}

function handleReminderClick(reminder: Reminder) {
  if (isDesktop.value) {
    selectedReminderId.value = reminder.id;
  } else {
    router.push({ name: ROUTE_NAMES.REMINDER_DETAIL, params: { id: reminder.id } });
  }
}

function handleAddReminder() {
  router.push({ name: ROUTE_NAMES.NEW_REMINDER });
}

// Detail panel modals
const showEditModal = ref(false);
const showDeleteModal = ref(false);

const { isUpdating, isDeleting, update, remove } = useEditReminder(userId.value);

function handleDetailEdit() {
  showEditModal.value = true;
}

function handleDetailDelete() {
  showDeleteModal.value = true;
}

async function handleUpdate(updates: Partial<Reminder>) {
  if (!selectedReminder.value) return;

  const success = await update(selectedReminder.value.id, updates);
  if (success) {
    showEditModal.value = false;
  }
}

async function handleDelete() {
  if (!selectedReminder.value) return;

  const success = await remove(selectedReminder.value.id);
  if (success) {
    showDeleteModal.value = false;
    selectedReminderId.value = null;
  }
}

function handleDetailClose() {
  selectedReminderId.value = null;
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-hidden"
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

    <MasterDetailLayout
      :selected="selectedReminderId"
      empty-icon="notifications"
      empty-text="Выберите напоминание для просмотра деталей"
      @close="handleDetailClose"
    >
      <template #master>
        <!-- Content -->
        <div class="pt-8 space-y-6">
          <!-- Statistics Cards -->
          <div v-if="reminders.length > 0" class="grid grid-cols-2 gap-3">
            <!-- Today count -->
            <UCard class="p-4">
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1">
                Сегодня
              </p>
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
            <h2
              class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark px-1"
            >
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
                  :class="[
                    isDueToday(reminder) && 'bg-reminder-light',
                    isDesktop &&
                      selectedReminderId === reminder.id &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark',
                  ]"
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
        </div>
      </template>

      <template #detail>
        <ReminderDetailPanel
          v-if="selectedReminderId && userId"
          :reminder-id="selectedReminderId"
          :user-id="userId"
          @edit="handleDetailEdit"
          @delete="handleDetailDelete"
        />
      </template>
    </MasterDetailLayout>

    <!-- Edit Reminder Modal (for detail panel) -->
    <EditReminderModal
      v-model="showEditModal"
      :reminder="selectedReminder"
      :currency="currency"
      :is-updating="isUpdating"
      @confirm="handleUpdate"
    />

    <!-- Delete Reminder Modal (for detail panel) -->
    <DeleteReminderModal
      v-model="showDeleteModal"
      :reminder="selectedReminder"
      :currency="currency"
      :is-deleting="isDeleting"
      @confirm="handleDelete"
    />
  </div>
</template>
