<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UInput } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';

/**
 * Отработка долга: человек рассчитывается не деньгами, а работой.
 *
 * Свёрнутый вид — одна тихая строка под формой платежа, а не четвёртый пресет
 * рядом с «Простить»: способ редкий, и в основном ряду он бы отнимал внимание у
 * обычного платежа. Развёрнутый вид объясняет главное следствие — деньги по
 * счетам не двигаются, поэтому выбирать счёт больше не нужно.
 */
const props = defineProps<{
  direction: 'given' | 'taken';
}>();

const modelValue = defineModel<boolean>({ required: true });
const note = defineModel<string>('note', { required: true });

const { trigger } = useHaptics();

const hint = computed(() =>
  props.direction === 'given'
    ? 'Долг гасит работа человека — по счетам ничего не двигается'
    : 'Долг гасит ваша работа — по счетам ничего не двигается',
);

const notePlaceholder = computed(() =>
  props.direction === 'given' ? 'Например: ремонт машины' : 'Например: две смены в кафе',
);

function toggle(next: boolean) {
  trigger('selection');
  modelValue.value = next;
}
</script>

<template>
  <!-- Свёрнуто: тихая строка, которую ищут глазами, а не натыкаются на неё -->
  <button
    v-if="!modelValue"
    type="button"
    data-testid="work-off-open"
    class="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-caption text-text-tertiary-light transition-colors hover:text-text-secondary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-tertiary-dark dark:hover:text-text-secondary-dark"
    @click="toggle(true)"
  >
    <UIcon name="handyman" size="xs" />
    Засчитать отработкой
  </button>

  <div
    v-else
    data-testid="work-off-field"
    class="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3"
  >
    <div class="flex items-start gap-2">
      <UIcon name="handyman" size="sm" class="mt-0.5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Гасим отработкой
        </p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          {{ hint }}
        </p>
      </div>
      <button
        type="button"
        data-testid="work-off-close"
        aria-label="Вернуться к платежу деньгами"
        class="shrink-0 rounded-lg p-1 text-text-tertiary-light transition-colors hover:text-text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-tertiary-dark dark:hover:text-text-primary-dark"
        @click="toggle(false)"
      >
        <UIcon name="close" size="xs" />
      </button>
    </div>

    <!-- Заметка необязательна: без неё в истории останется просто «Отработка
         долга: Имя», с ней — что именно было сделано -->
    <UInput v-model="note" size="sm" :placeholder="notePlaceholder" />
  </div>
</template>
