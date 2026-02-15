<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { UButton, UIcon, UCard } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import {
  useReminders,
  FREQUENCY_LABELS,
  type Reminder,
} from '@/entities/reminder';
import {
  EditReminderModal,
  DeleteReminderModal,
  useEditReminder,
} from '@/features/edit-reminder';
import { navigateBack } from '@/app/router';

const router = useRouter();
const route = useRoute();
const user = inject<Ref<User | null>>('user');

const userId = computed(() => user?.value?.id ?? '');
const reminderId = computed(() => route.params.id as string);

// Get currency from localStorage
const currency = localStorage.getItem('selectedCurrency') || 'UZS';

// Get reminders
const { reminders, isLoading } = useReminders(userId);

// Find current reminder
const reminder = computed<Reminder | null>(() => {
  return reminders.value.find((r) => r.id === reminderId.value) ?? null;
});

// Check status
const isUpcoming = computed(() => {
  if (!reminder.value) return false;
  const nextDateMs = new Date(reminder.value.next_date).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return nextDateMs - Date.now() < threeDays && nextDateMs > Date.now();
});

const isOverdue = computed(() => {
  if (!reminder.value) return false;
  return new Date(reminder.value.next_date).getTime() < Date.now();
});

// Modal states
const showEditModal = ref(false);
const showDeleteModal = ref(false);

// Edit reminder logic
const { isUpdating, isDeleting, update, remove } = useEditReminder(
  userId.value,
);

async function handleUpdate(updates: Partial<Reminder>) {
  if (!reminder.value) return;

  const success = await update(reminder.value.id, updates);
  if (success) {
    showEditModal.value = false;
  }
}

async function handleDelete() {
  if (!reminder.value) return;

  const success = await remove(reminder.value.id);
  if (success) {
    showDeleteModal.value = false;
    router.push({ name: 'dashboard' });
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <header
      class="sticky top-0 z-30 pt-[var(--safe-area-inset-top)] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl"
    >
      <div class="flex items-center justify-between px-4 py-4">
        <UButton variant="ghost" size="sm" @click="goBack">
          <UIcon name="arrow_back" size="md" />
        </UButton>
        <h1
          class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Подписка
        </h1>
        <div class="w-10" />
      </div>
    </header>

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>

      <!-- Not Found State -->
      <div v-else-if="!reminder" class="text-center py-12">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon
            name="error"
            size="xl"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
          Подписка не найдена
        </p>
        <UButton variant="primary" @click="router.push({ name: 'dashboard' })">
          На главную
        </UButton>
      </div>

      <!-- Reminder Details -->
      <div v-else class="space-y-6">
        <!-- Main Card -->
        <UCard class="p-5">
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              :class="[
                isOverdue
                  ? 'bg-danger/10'
                  : isUpcoming
                    ? 'bg-warning/10'
                    : 'bg-reminder-light',
              ]"
            >
              <UIcon
                :name="reminder.icon"
                size="lg"
                :class="[
                  isOverdue
                    ? 'text-danger'
                    : isUpcoming
                      ? 'text-warning'
                      : 'text-reminder',
                ]"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p
                class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ reminder.name }}
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ FREQUENCY_LABELS[reminder.frequency] }}
              </p>
            </div>

            <!-- Status Badge -->
            <span
              v-if="isOverdue"
              class="px-3 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger"
            >
              Просрочено
            </span>
            <span
              v-else-if="isUpcoming"
              class="px-3 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning"
            >
              Скоро
            </span>
            <span
              v-else-if="!reminder.is_active"
              class="px-3 py-1 rounded-full text-xs font-medium bg-neutral-light text-neutral"
            >
              Неактивна
            </span>
          </div>

          <!-- Amount -->
          <div
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark"
          >
            <div class="flex justify-between items-end">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                Сумма платежа
              </span>
              <span
                class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
              >
                {{ formatCurrency(reminder.amount, currency) }}
              </span>
            </div>
          </div>
        </UCard>

        <!-- Details Card -->
        <UCard variant="default" class="p-5 space-y-4">
          <!-- Next Date -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Следующий платёж
            </span>
            <span
              class="text-sm font-medium"
              :class="[
                isOverdue
                  ? 'text-danger'
                  : isUpcoming
                    ? 'text-warning'
                    : 'text-text-primary-light dark:text-text-primary-dark',
              ]"
            >
              {{
                formatDate(new Date(reminder.next_date).getTime(), {
                  format: 'full',
                })
              }}
            </span>
          </div>

          <!-- Frequency -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Частота
            </span>
            <span
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ FREQUENCY_LABELS[reminder.frequency] }}
            </span>
          </div>

          <!-- Status -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Статус
            </span>
            <span
              class="text-sm font-medium"
              :class="
                reminder.is_active
                  ? 'text-success'
                  : 'text-text-tertiary-light dark:text-text-tertiary-dark'
              "
            >
              {{ reminder.is_active ? 'Активна' : 'Неактивна' }}
            </span>
          </div>
        </UCard>

        <!-- Actions -->
        <div class="space-y-3">
          <UButton
            variant="primary"
            size="xl"
            full-width
            @click="showEditModal = true"
          >
            <UIcon name="edit" size="sm" class="mr-2" />
            Редактировать
          </UButton>

          <UButton
            variant="ghost"
            size="lg"
            full-width
            class="text-danger"
            @click="showDeleteModal = true"
          >
            <UIcon name="delete" size="sm" class="mr-2" />
            Удалить подписку
          </UButton>
        </div>
      </div>
    </main>

    <!-- Edit Reminder Modal -->
    <EditReminderModal
      v-model="showEditModal"
      :reminder="reminder"
      :currency="currency"
      :is-updating="isUpdating"
      @confirm="handleUpdate"
    />

    <!-- Delete Reminder Modal -->
    <DeleteReminderModal
      v-model="showDeleteModal"
      :reminder="reminder"
      :currency="currency"
      :is-deleting="isDeleting"
      @confirm="handleDelete"
    />
  </div>
</template>
