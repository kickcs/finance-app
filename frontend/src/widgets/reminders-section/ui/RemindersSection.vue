<script setup lang="ts">
import { computed } from 'vue';
import { type Reminder } from '@/entities/reminder';
import { UBadge, SectionHeader, IconBadge, EmptyState } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { isReminderUpcoming, isReminderOverdue } from '@/entities/reminder';

const props = defineProps<{
  reminders: Reminder[];
  currency: string;
  loading?: boolean;
  hidden?: boolean;
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

function iconBgClass(reminder: Reminder): string {
  if (isReminderOverdue(reminder)) return 'bg-danger/10';
  if (isReminderUpcoming(reminder)) return 'bg-warning/10';
  return 'bg-surface-light dark:bg-surface-dark';
}

function iconClass(reminder: Reminder): string {
  if (isReminderOverdue(reminder)) return 'text-danger';
  if (isReminderUpcoming(reminder)) return 'text-warning';
  return 'text-text-secondary-light dark:text-text-secondary-dark';
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      title="Подписки"
      :count="reminders.length"
      @add-click="$emit('add-click')"
      @view-all="$emit('view-all')"
    >
      <template #badge>
        <UBadge v-if="todayCount > 0" variant="primary" size="xs">{{ todayCount }} сегодня</UBadge>
      </template>
    </SectionHeader>

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
        :aria-label="`${reminder.name}, ${formatMasked(reminder.amount, currency || DEFAULT_CURRENCY, hidden ?? false)}`"
        @click="$emit('reminder-click', reminder)"
      >
        <!-- Icon -->
        <IconBadge
          :icon="reminder.icon"
          size="md"
          :bg-class="iconBgClass(reminder)"
          :icon-class="iconClass(reminder)"
          class="mb-2.5"
        />

        <!-- Name -->
        <p
          class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate mb-0.5"
        >
          {{ reminder.name }}
        </p>

        <!-- Amount -->
        <p class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{
            formatMasked(
              reminder.amount,
              currency || DEFAULT_CURRENCY,
              hidden ?? false,
              COMPACT_FORMAT,
            )
          }}
        </p>
      </button>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else
      variant="inline"
      icon="notifications"
      title="Нет подписок"
      description="Добавьте для отслеживания платежей"
      :action="{ label: 'Добавить', onClick: () => $emit('add-click') }"
    />
  </div>
</template>
