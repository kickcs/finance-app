<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { type DateValue } from '@internationalized/date';
import { UIcon } from '@/shared/ui/icon';
import { cn } from '@/shared/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { isoToCalendarDate, dateValueToISO } from '@/shared/lib/date';
import { formatCompactDate } from '@/shared/lib/format/date';

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    placeholder?: string;
    clearable?: boolean;
    portalTo?: HTMLElement | null;
    /**
     * `field` — поле с рамкой во всю ширину; `flush` — внутри готовой строки
     * списка, без своей рамки (она была бы второй); `chip` — чип той же
     * геометрии, что чипы рядом с ним, чтобы вставать с ними в один ряд.
     */
    variant?: 'field' | 'flush' | 'chip';
    /** Подпись для скринридера: в чипе видна только дата, без назначения поля. */
    ariaLabel?: string;
  }>(),
  { variant: 'field' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

// Тот же расчёт, что в `TransactionMetaRow`: календарь нужен только раскрытому
// поповеру, а его модуль — из самых тяжёлых на экране.
const Calendar = defineAsyncComponent(() => import('@/shared/ui/primitives/calendar/Calendar.vue'));

const isOpen = defineModel<boolean>('open', { default: false });

const calendarValue = computed(() => isoToCalendarDate(props.modelValue));

const displayText = computed(() =>
  props.modelValue ? formatCompactDate(props.modelValue) : (props.placeholder ?? 'Без срока'),
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
          :aria-label="ariaLabel"
          :class="
            cn(
              'flex items-center gap-2 transition-all',
              // Чип повторяет геометрию соседних чипов (рамка, `rounded-lg`,
              // `px-3 py-1.5`) и обходится без шеврона: в ряду одинаковых чипов
              // он читался бы как единственная «неровная» кнопка.
              variant === 'chip'
                ? 'w-full justify-center rounded-lg border border-border-light px-3 py-1.5 hover:border-primary/40 dark:border-border-dark'
                : 'flex-1 justify-between py-3',
              variant === 'field' &&
                'px-4 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/50',
              variant === 'flush' && 'px-3',
              modelValue
                ? 'text-text-primary-light dark:text-text-primary-dark'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            )
          "
        >
          <div class="flex min-w-0 items-center gap-1.5">
            <UIcon
              name="calendar_month"
              size="sm"
              class="shrink-0 text-text-secondary-light dark:text-text-secondary-dark"
            />
            <span class="truncate text-sm">{{ displayText }}</span>
          </div>
          <UIcon
            v-if="variant !== 'chip'"
            name="expand_more"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark transition-transform"
            :class="{ 'rotate-180': isOpen }"
          />
        </button>
      </PopoverTrigger>
      <!--
        Календарь открывается вверх и с отступом от края. На дефолтных
        `side="bottom"` + `collisionPadding: 0` он свисал за экран на низком
        вьюпорте и под поднявшейся клавиатурой — часть дат была недоступна.
        Ровно эта конфигурация работает в `TransactionMetaRow`.
      -->
      <PopoverContent
        class="w-auto p-0"
        align="start"
        side="top"
        :side-offset="8"
        :collision-padding="16"
        :to="portalTo"
      >
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
