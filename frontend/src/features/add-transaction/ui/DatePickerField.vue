<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { type DateValue } from '@internationalized/date';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { isoToCalendarDate, dateValueToISO } from '@/shared/lib/date';
import { formatDate } from '@/shared/lib/format/date';

const props = defineProps<{
  modelValue: string | null;
  placeholder?: string;
  clearable?: boolean;
  portalTo?: HTMLElement | null;
  /** Поле внутри готовой строки списка: без своей рамки — она была бы второй. */
  flush?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

// Тот же расчёт, что в `TransactionMetaRow`: календарь нужен только раскрытому
// поповеру, а его модуль — из самых тяжёлых на экране.
const Calendar = defineAsyncComponent(() => import('@/shared/ui/primitives/calendar/Calendar.vue'));

const isOpen = defineModel<boolean>('open', { default: false });

const calendarValue = computed(() => isoToCalendarDate(props.modelValue));

function formatCompact(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const base = formatDate(date, { format: 'short' });
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} ${y}`;
}

const displayText = computed(() =>
  props.modelValue ? formatCompact(props.modelValue) : (props.placeholder ?? 'Без срока'),
);

function handleChange(value: DateValue | undefined) {
  const iso = dateValueToISO(value);
  if (!iso) return;
  emit('update:modelValue', iso);
  isOpen.value = false;
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="
            cn(
              'flex-1 flex items-center justify-between gap-2 py-3 transition-all',
              flush
                ? 'px-3'
                : 'px-4 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/50',
              modelValue
                ? 'text-text-primary-light dark:text-text-primary-dark'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            )
          "
        >
          <div class="flex items-center gap-2">
            <UIcon
              name="calendar_month"
              size="sm"
              class="text-text-secondary-light dark:text-text-secondary-dark"
            />
            <span class="text-sm">{{ displayText }}</span>
          </div>
          <UIcon
            name="expand_more"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
            :class="{ 'rotate-180': isOpen }"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start" :to="portalTo">
        <Calendar
          v-if="isOpen"
          :model-value="calendarValue"
          locale="ru-RU"
          @update:model-value="handleChange"
        />
      </PopoverContent>
    </Popover>
    <button
      v-if="clearable && modelValue"
      type="button"
      class="p-2 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:text-danger transition-colors"
      @click="$emit('update:modelValue', null)"
    >
      <UIcon name="close" size="sm" />
    </button>
  </div>
</template>
