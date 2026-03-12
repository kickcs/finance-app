<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon, UCard, USpinner, UBadge } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import {
  useReminders,
  FREQUENCY_LABELS,
  isReminderUpcoming,
  isReminderOverdue,
} from '@/entities/reminder';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const props = defineProps<{
  reminderId: string;
  userId: string;
}>();

defineEmits<{
  edit: [];
  delete: [];
}>();

const { currency } = useUserCurrency();

// Get reminders
const { reminders, isLoading } = useReminders(() => props.userId);

// Find current reminder
const reminder = computed(() => {
  return reminders.value.find((r) => r.id === props.reminderId) ?? null;
});

// Check status
const isUpcoming = computed(() => !!reminder.value && isReminderUpcoming(reminder.value));
const isOverdue = computed(() => !!reminder.value && isReminderOverdue(reminder.value));
</script>

<template>
  <div class="py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <USpinner />
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="!reminder"
      class="flex flex-col items-center justify-center py-12 text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <UIcon name="error" size="lg" class="mb-2" />
      <p class="text-body-sm">Подписка не найдена</p>
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
              isOverdue ? 'bg-danger/10' : isUpcoming ? 'bg-warning/10' : 'bg-reminder-light',
            ]"
          >
            <UIcon
              :name="reminder.icon"
              size="lg"
              :class="[isOverdue ? 'text-danger' : isUpcoming ? 'text-warning' : 'text-reminder']"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p
              class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ reminder.name }}
            </p>
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {{ FREQUENCY_LABELS[reminder.frequency] }}
            </p>
          </div>

          <!-- Status Badge -->
          <UBadge v-if="isOverdue" variant="danger" shape="pill">Просрочено</UBadge>
          <UBadge v-else-if="isUpcoming" variant="warning" shape="pill">Скоро</UBadge>
          <UBadge v-else-if="!reminder.is_active" variant="neutral" shape="pill">Неактивна</UBadge>
        </div>

        <!-- Amount -->
        <div class="mt-6 pt-6 border-t border-border-light dark:border-border-dark">
          <div class="flex justify-between items-end">
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Сумма платежа
            </span>
            <span class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(reminder.amount, currency) }}
            </span>
          </div>
        </div>
      </UCard>

      <!-- Details Card -->
      <UCard variant="default" class="p-5 space-y-4">
        <!-- Next Date -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
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
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Частота
          </span>
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ FREQUENCY_LABELS[reminder.frequency] }}
          </span>
        </div>

        <!-- Status -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
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
        <UButton variant="primary" size="lg" full-width @click="$emit('edit')">
          <UIcon name="edit" size="sm" class="mr-2" />
          Редактировать
        </UButton>

        <UButton variant="ghost" size="lg" full-width class="text-danger" @click="$emit('delete')">
          <UIcon name="delete" size="sm" class="mr-2" />
          Удалить подписку
        </UButton>
      </div>
    </div>
  </div>
</template>
