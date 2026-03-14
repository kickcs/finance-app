<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { AccountSelector } from '@/entities/account';
import { CategoryChips, EXPENSE_CATEGORIES } from '@/entities/category';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import type { ScanReceiptFormData } from '../model/types';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  formData: ScanReceiptFormData;
  accounts: AccountWithBalances[];
}>();

const emit = defineEmits<{
  'update:formData': [value: ScanReceiptFormData];
}>();

const calendarOpen = ref(false);

const calendarValue = computed(() => {
  const d = new Date(props.formData.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

const displayDate = computed(() => {
  const d = new Date(props.formData.date);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
});

function onDateSelect(value: DateValue | undefined) {
  if (!value) return;
  const date = new Date(value.year, value.month - 1, value.day);
  emit('update:formData', {
    ...props.formData,
    date: date.getTime(),
  });
  calendarOpen.value = false;
}
</script>

<template>
  <section aria-label="Параметры транзакции" class="mt-6">
    <h2
      class="text-[11px] font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-2 ml-4"
    >
      Оплата
    </h2>

    <div
      class="bg-surface-light dark:bg-surface-dark rounded-2xl overflow-hidden drop-shadow-sm border border-border-light/50 dark:border-border-dark/50 divide-y divide-border-light dark:divide-border-dark"
    >
      <!-- Account -->
      <div class="px-4 py-3">
        <AccountSelector
          :accounts="accounts"
          :selected-id="formData.accountId"
          label="Списать со счёта"
          @select="$emit('update:formData', { ...formData, accountId: $event })"
        />
      </div>

      <!-- Category -->
      <div class="px-4 py-3">
        <CategoryChips
          :categories="EXPENSE_CATEGORIES"
          :selected-id="formData.categoryId"
          label="Категория"
          @select="$emit('update:formData', { ...formData, categoryId: $event })"
        />
      </div>

      <!-- Date & Description -->
      <div class="grid grid-cols-2 divide-x divide-border-light dark:divide-border-dark">
        <div class="px-4 py-3 flex flex-col justify-center">
          <label
            class="text-[10px] font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider mb-1.5"
          >
            Дата
          </label>
          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex items-center justify-between w-full text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-all duration-150 outline-none"
              >
                <span>{{ displayDate }}</span>
                <UIcon
                  name="calendar_today"
                  size="xs"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" :side-offset="8" class="w-auto p-0">
              <Calendar
                :model-value="calendarValue"
                locale="ru-RU"
                @update:model-value="onDateSelect"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div class="px-4 py-3 flex flex-col justify-center">
          <label
            class="text-[10px] font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider mb-1.5"
          >
            Заметка
          </label>
          <input
            :value="formData.description"
            type="text"
            placeholder="#ужин..."
            class="w-full bg-transparent text-sm font-medium outline-none text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark"
            @input="
              $emit('update:formData', {
                ...formData,
                description: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
      </div>
    </div>
  </section>
</template>
