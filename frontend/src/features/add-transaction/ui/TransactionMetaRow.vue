<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatDate } from '@/shared/lib/format/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { CalendarDate, type DateValue } from '@internationalized/date';

const props = defineProps<{
  description: string;
  date: number;
  placeholder: string;
  /** Подсказки хэштегов для раскрытого поля комментария. */
  hashtags: { tag: string }[];
}>();

const emit = defineEmits<{
  'update:description': [value: string];
  'update:date': [value: number];
  'insert-hashtag': [tag: string];
}>();

// Календарь тянет reka-примитив и открывается по нажатию — в чанк, который
// парсится в кадре старта слайда, ему попадать незачем.
const Calendar = defineAsyncComponent(() => import('@/shared/ui/primitives/calendar/Calendar.vue'));

const calendarOpen = ref(false);
const commentOpen = ref(false);
/**
 * Поле остаётся раскрытым, пока в нём есть текст, — а подсказки хэштегов нужны
 * только пока в него печатают. Без отдельного флага чипы висели бы на экране
 * после ухода фокуса.
 */
const commentFocused = ref(false);
const commentInput = ref<HTMLInputElement | null>(null);

const displayDate = computed(() => formatDate(props.date, { format: 'short' }));

const calendarValue = computed(() => {
  const d = new Date(props.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

function onCalendarSelect(value: DateValue | undefined) {
  if (!value) return;
  emit('update:date', new Date(value.year, value.month - 1, value.day).getTime());
  calendarOpen.value = false;
}

function openComment() {
  commentOpen.value = true;
  nextTick(() => commentInput.value?.focus());
}

/**
 * Схлопываем обратно в чип, только если комментарий пуст: с текстом поле должно
 * остаться открытым, иначе непонятно, куда делось написанное.
 */
function onCommentBlur() {
  commentFocused.value = false;
  if (!props.description.trim()) commentOpen.value = false;
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="!commentOpen" class="flex items-center gap-2">
      <button
        type="button"
        class="meta-chip flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3 py-2.5 text-left transition-[color,background-color,border-color,transform] duration-200 hover:border-primary/40 active:scale-[0.99]"
        @click="openComment"
      >
        <UIcon
          name="edit_note"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <span
          class="truncate text-sm"
          :class="
            description
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ description || 'Комментарий' }}
        </span>
      </button>

      <Popover v-model:open="calendarOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            aria-label="Выбрать дату"
            class="meta-chip flex shrink-0 items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3 py-2.5 text-sm text-text-primary-light dark:text-text-primary-dark transition-[color,background-color,border-color,transform] duration-200 hover:border-primary/40 active:scale-[0.99]"
          >
            <UIcon
              name="calendar_today"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
            {{ displayDate }}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          :side-offset="8"
          :collision-padding="16"
          class="w-auto p-0"
        >
          <Calendar
            v-if="calendarOpen"
            :model-value="calendarValue"
            locale="ru-RU"
            @update:model-value="onCalendarSelect"
          />
        </PopoverContent>
      </Popover>
    </div>

    <!-- Раскрытый комментарий занимает всю ширину: хэштеги под ним не двигают
         кнопку сабмита — она живёт в подвале вне скролла. -->
    <div v-else class="space-y-2">
      <div
        class="flex items-center gap-2 rounded-xl border border-primary/40 bg-card-light dark:bg-card-dark px-3 py-2.5"
      >
        <UIcon
          name="edit_note"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <input
          ref="commentInput"
          :value="description"
          type="text"
          aria-label="Комментарий"
          :placeholder="placeholder"
          class="min-w-0 flex-1 bg-transparent text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark focus:outline-none"
          @input="emit('update:description', ($event.target as HTMLInputElement).value)"
          @focus="commentFocused = true"
          @blur="onCommentBlur"
          @keydown.enter.prevent="commentInput?.blur()"
        />
      </div>

      <Transition name="hashtags">
        <div
          v-if="commentFocused && hashtags.length"
          class="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        >
          <button
            v-for="h in hashtags"
            :key="h.tag"
            type="button"
            class="hashtag-chip shrink-0 rounded-full border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark transition-[color,background-color,border-color,transform] duration-200 hover:border-primary/30 hover:bg-primary-light hover:text-primary active:scale-95"
            @mousedown.prevent="emit('insert-hashtag', h.tag)"
          >
            {{ h.tag }}
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.hashtags-enter-active,
.hashtags-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.hashtags-enter-from,
.hashtags-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .hashtags-enter-active,
  .hashtags-leave-active,
  .hashtag-chip,
  .meta-chip {
    transition: none;
  }
}
</style>
