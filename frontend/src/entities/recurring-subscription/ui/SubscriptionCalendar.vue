<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { RecurringSubscription } from '../model/types';
import { computeBillingDatesForMonth } from '../model/utils';

const props = defineProps<{
  subscriptions: RecurringSubscription[];
  currentMonth: Date;
  totalAmount?: number;
  currency?: string;
}>();

const emit = defineEmits<{
  'update:currentMonth': [date: Date];
  dayClick: [date: string];
}>();

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const { trigger } = useHaptics();

// Current month/year info
const year = computed(() => props.currentMonth.getFullYear());
const month = computed(() => props.currentMonth.getMonth() + 1); // 1-based

const monthLabel = computed(() => {
  return `${MONTH_NAMES[month.value - 1]} ${year.value}`;
});

// Build a map: dayNumber -> subscriptions[]
const daySubscriptionMap = computed(() => {
  const map = new Map<number, RecurringSubscription[]>();

  for (const sub of props.subscriptions) {
    if (sub.status !== 'active') continue;
    const dates = computeBillingDatesForMonth(sub, year.value, month.value);
    for (const dateStr of dates) {
      const day = parseInt(dateStr.split('-')[2], 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(sub);
    }
  }

  return map;
});

// Calendar grid computation
const calendarDays = computed(() => {
  const firstDay = new Date(year.value, month.value - 1, 1);
  const lastDay = new Date(year.value, month.value, 0);
  const daysInMonth = lastDay.getDate();

  // Monday-based: getDay() returns 0=Sun, convert so Mon=0
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: Array<{ day: number | null; subscriptions: RecurringSubscription[] }> = [];

  // Empty offset cells
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, subscriptions: [] });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      subscriptions: daySubscriptionMap.value.get(d) || [],
    });
  }

  return cells;
});

// Is today check
const todayDay = computed(() => {
  const now = new Date();
  if (now.getFullYear() === year.value && now.getMonth() + 1 === month.value) {
    return now.getDate();
  }
  return null;
});

// Total amount label — totalAmount is already normalized to monthly
const totalLabel = computed(() => {
  if (props.totalAmount === null || props.totalAmount === undefined || !props.currency) return null;
  return formatCurrency(props.totalAmount, props.currency) + '/мес';
});

function prevMonth() {
  trigger('selection');
  const d = new Date(props.currentMonth);
  d.setMonth(d.getMonth() - 1);
  emit('update:currentMonth', d);
}

function nextMonth() {
  trigger('selection');
  const d = new Date(props.currentMonth);
  d.setMonth(d.getMonth() + 1);
  emit('update:currentMonth', d);
}

function handleDayClick(day: number | null) {
  if (day === null) return;
  trigger('selection');
  const m = String(month.value).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  emit('dayClick', `${year.value}-${m}-${d}`);
}
</script>

<template>
  <div
    class="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-4"
  >
    <!-- Header: month navigation + total -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          aria-label="Предыдущий месяц"
          @click="prevMonth"
        >
          <UIcon
            name="chevron_left"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark"
          />
        </button>
        <h3
          class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark min-w-[140px] text-center"
        >
          {{ monthLabel }}
        </h3>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          aria-label="Следующий месяц"
          @click="nextMonth"
        >
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark"
          />
        </button>
      </div>
      <p
        v-if="totalLabel"
        class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
      >
        {{ totalLabel }}
      </p>
    </div>

    <!-- Day-of-week headers -->
    <div class="grid grid-cols-7 gap-1 mb-1">
      <div
        v-for="name in DAY_NAMES"
        :key="name"
        class="text-center text-caption text-text-tertiary-light dark:text-text-tertiary-dark font-medium py-1"
      >
        {{ name }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(cell, idx) in calendarDays"
        :key="idx"
        :disabled="cell.day == null"
        :class="[
          'min-h-[48px] p-1 rounded-lg text-center flex flex-col items-center justify-start gap-0.5 transition-colors',
          cell.day != null && 'hover:bg-surface-light dark:hover:bg-surface-dark cursor-pointer',
          cell.day == null && 'cursor-default',
          cell.day === todayDay && 'ring-1 ring-primary ring-inset',
        ]"
        :style="
          cell.subscriptions.length > 0
            ? { backgroundColor: cell.subscriptions[0].color + '10' }
            : undefined
        "
        @click="handleDayClick(cell.day)"
      >
        <!-- Day number -->
        <span
          v-if="cell.day != null"
          :class="[
            'text-xs leading-tight',
            cell.day === todayDay
              ? 'font-semibold text-primary'
              : cell.subscriptions.length > 0
                ? 'font-medium text-text-primary-light dark:text-text-primary-dark'
                : 'text-text-secondary-light dark:text-text-secondary-dark',
          ]"
        >
          {{ cell.day }}
        </span>

        <!-- Subscription icons -->
        <div
          v-if="cell.subscriptions.length > 0"
          class="flex items-center gap-px flex-wrap justify-center"
        >
          <template v-for="sub in cell.subscriptions.slice(0, 3)" :key="sub.id">
            <UIcon :name="sub.icon" size="xs" :style="{ color: sub.color }" />
          </template>
          <span
            v-if="cell.subscriptions.length > 3"
            class="text-caption-xs text-text-tertiary-light dark:text-text-tertiary-dark font-medium"
          >
            +{{ cell.subscriptions.length - 3 }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
