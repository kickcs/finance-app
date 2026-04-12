<script setup lang="ts">
import { computed } from 'vue';
import { type DateValue } from '@internationalized/date';
import { UIcon } from '@/shared/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { isoToCalendarDate, isoToDisplayDate, dateValueToISO } from '@/shared/lib/date';

const props = defineProps<{
  modelValue: string | null;
  placeholder?: string;
  clearable?: boolean;
  portalTo?: HTMLElement | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const isOpen = defineModel<boolean>('open', { default: false });

const calendarValue = computed(() => isoToCalendarDate(props.modelValue));
const displayText = computed(() =>
  props.modelValue ? isoToDisplayDate(props.modelValue) : (props.placeholder ?? 'Без срока'),
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
          class="flex-1 flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:border-primary/50 transition-all"
          :class="
            modelValue
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
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
        <Calendar :model-value="calendarValue" locale="ru-RU" @update:model-value="handleChange" />
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
