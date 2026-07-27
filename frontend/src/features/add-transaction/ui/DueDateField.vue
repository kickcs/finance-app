<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';
import { toLocalISODate, getTodayISO } from '@/shared/lib/date';
import DatePickerField from './DatePickerField.vue';

/**
 * Срок возврата долга.
 *
 * Календарь для этого поля был лишним: срок почти всегда круглый — «через
 * неделю», «через месяц». Пресеты закрывают эти случаи одним нажатием, а
 * календарь остаётся для нерегулярных дат.
 */
const props = defineProps<{ modelValue: string | null }>();

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const isCalendarOpen = ref(false);

/**
 * «Сегодня» держим в ref, а не читаем `new Date()` внутри `computed`: у набора
 * пресетов не было бы ни одной реактивной зависимости, и посчитанный при
 * создании компонента список так и остался бы вчерашним. PWA живёт неделями,
 * поэтому дату обновляем при каждом возврате на вкладку.
 */
const today = ref(getTodayISO());
const visibility = useDocumentVisibility();
watch(visibility, (state) => {
  if (state === 'visible') today.value = getTodayISO();
});

function shiftedISO(base: string, shift: (date: Date) => void): string {
  // Полдень, а не полночь: сдвиг на месяц через границу перехода на летнее
  // время иначе мог бы отдать соседние сутки.
  const date = new Date(`${base}T12:00:00`);
  shift(date);
  return toLocalISODate(date);
}

const presets = computed(() => [
  { label: 'Без срока', value: null },
  { label: 'Неделя', value: shiftedISO(today.value, (d) => d.setDate(d.getDate() + 7)) },
  { label: '2 недели', value: shiftedISO(today.value, (d) => d.setDate(d.getDate() + 14)) },
  { label: 'Месяц', value: shiftedISO(today.value, (d) => d.setMonth(d.getMonth() + 1)) },
]);

/** Дата, не попавшая ни в один пресет, живёт в чипе календаря. */
const isCustom = computed(
  () => props.modelValue !== null && !presets.value.some((p) => p.value === props.modelValue),
);
</script>

<template>
  <div>
    <label
      class="mb-1.5 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      Срок возврата
    </label>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        data-testid="due-preset"
        :aria-pressed="modelValue === preset.value"
        class="due-chip shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
        :class="
          modelValue === preset.value
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border-light text-text-secondary-light hover:text-text-primary-light dark:border-border-dark dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
        "
        @click="emit('update:modelValue', preset.value)"
      >
        {{ preset.label }}
      </button>

      <DatePickerField
        v-model:open="isCalendarOpen"
        variant="chip"
        :model-value="isCustom ? modelValue : null"
        placeholder="Дата…"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .due-chip {
    transition: none;
  }
}
</style>
