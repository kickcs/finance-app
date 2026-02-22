<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { RangeCalendar } from '@/shared/ui/primitives/range-calendar';
import { UIcon } from '@/shared/ui';
import type { DateRange } from '../model/types';

const props = defineProps<{
  modelValue: DateRange;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DateRange];
}>();

const isOpen = ref(false);

// Convert string date to CalendarDate
function parseDate(dateStr: string | null): DateValue | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new CalendarDate(year, month, day);
}

// Convert CalendarDate to string
function formatDate(date: DateValue | undefined): string | null {
  if (!date) return null;
  const year = date.year;
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calendar value (DateRange format for reka-ui)
const calendarValue = computed({
  get: () => ({
    start: parseDate(props.modelValue.startDate),
    end: parseDate(props.modelValue.endDate),
  }),
  set: (value: { start: DateValue | undefined; end: DateValue | undefined }) => {
    emit('update:modelValue', {
      startDate: formatDate(value.start),
      endDate: formatDate(value.end),
    });
  },
});

// Display label
const displayLabel = computed(() => {
  const start = props.modelValue.startDate;
  const end = props.modelValue.endDate;

  if (start && end) {
    const startFormatted = formatDisplayDate(start);
    const endFormatted = formatDisplayDate(end);
    return `${startFormatted} - ${endFormatted}`;
  }

  if (start) {
    return `С ${formatDisplayDate(start)}`;
  }

  return 'Выберите период';
});

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

// Get today's date as CalendarDate for maxValue
const today = new CalendarDate(
  new Date().getFullYear(),
  new Date().getMonth() + 1,
  new Date().getDate(),
);
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:border-primary/50 hover:bg-surface-light dark:hover:bg-surface-dark transition-all duration-200"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="calendar_month"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark"
          />
          <span class="text-sm font-medium">
            {{ displayLabel }}
          </span>
        </div>
        <UIcon
          name="expand_more"
          size="sm"
          class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <RangeCalendar v-model="calendarValue" locale="ru-RU" :max-value="today" class="rounded-xl" />
    </PopoverContent>
  </Popover>
</template>
