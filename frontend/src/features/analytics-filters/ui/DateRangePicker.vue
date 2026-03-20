<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { RangeCalendar } from '@/shared/ui/primitives/range-calendar';
import { UIcon } from '@/shared/ui';
import { formatDate } from '@/shared/lib/format/date';
import { isoToCalendarDate, dateValueToISO } from '@/shared/lib/date';
import type { DateRange } from '../model/types';

const props = defineProps<{
  modelValue: DateRange;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DateRange];
}>();

const isOpen = ref(false);

// Calendar value (DateRange format for reka-ui)
const calendarValue = computed({
  get: () => ({
    start: isoToCalendarDate(props.modelValue.startDate),
    end: isoToCalendarDate(props.modelValue.endDate),
  }),
  set: (value: { start: DateValue | undefined; end: DateValue | undefined }) => {
    emit('update:modelValue', {
      startDate: dateValueToISO(value.start),
      endDate: dateValueToISO(value.end),
    });
  },
});

// Display label
const displayLabel = computed(() => {
  const start = props.modelValue.startDate;
  const end = props.modelValue.endDate;

  if (start && end) {
    return `${formatDate(start, { format: 'short' })} - ${formatDate(end, { format: 'short' })}`;
  }

  if (start) {
    return `С ${formatDate(start, { format: 'short' })}`;
  }

  return 'Выберите период';
});

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
        data-testid="date-range-picker-trigger"
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
