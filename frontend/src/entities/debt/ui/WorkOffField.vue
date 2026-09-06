<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UInput, ToggleRow } from '@/shared/ui';
import { CategoryChips, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/entities/category';
import { useHaptics } from '@/shared/lib/haptics';

/**
 * Отработка долга: человек рассчитывается не деньгами, а работой.
 *
 * Свёрнутый вид — одна тихая строка под формой платежа, а не четвёртый пресет
 * рядом с «Простить»: способ редкий, и в основном ряду он бы отнимал внимание у
 * обычного платежа. Развёрнутый вид объясняет главное следствие — деньги по
 * счетам не двигаются, поэтому выбирать счёт больше не нужно.
 *
 * Категория работы необязательна и решает, попадёт ли отработка в аналитику:
 * без неё остаётся одна информационная отметка, с ней сервер пишет пару
 * «трата по категории + возврат долга» — по балансу ноль, а в отчёте сумма
 * переезжает из «Невозвращённых долгов» в выбранную категорию.
 */
const props = defineProps<{
  direction: 'given' | 'taken';
}>();

const modelValue = defineModel<boolean>({ required: true });
const note = defineModel<string>('note', { required: true });
const categoryId = defineModel<string | null>('categoryId', { required: true });

const { trigger } = useHaptics();

const hint = computed(() =>
  props.direction === 'given'
    ? 'Долг гасит работа человека — по счетам ничего не двигается'
    : 'Долг гасит ваша работа — по счетам ничего не двигается',
);

const notePlaceholder = computed(() =>
  props.direction === 'given' ? 'Например: ремонт машины' : 'Например: две смены в кафе',
);

// Работу человека вы «покупаете» — это трата; свою работу вы продаёте — доход.
const countsAsExpense = computed(() => props.direction === 'given');

const accountingTitle = computed(() =>
  countsAsExpense.value ? 'Учесть работу тратой' : 'Учесть работу доходом',
);

const accountingHint = computed(() =>
  countsAsExpense.value
    ? 'Сумма попадёт в аналитику выбранной категорией вместо «Невозвращённых долгов»'
    : 'Сумма попадёт в аналитику доходом по выбранной категории',
);

const workCategories = computed(() =>
  countsAsExpense.value ? EXPENSE_CATEGORIES : INCOME_CATEGORIES,
);

const defaultCategoryId = computed(() => workCategories.value[0]?.id ?? '');

const countInAnalytics = computed({
  get: () => categoryId.value !== null,
  set: (next: boolean) => {
    trigger('selection');
    categoryId.value = next ? defaultCategoryId.value : null;
  },
});

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
    class="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3"
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

    <!-- Выключено по умолчанию: отработка — прежде всего отметка «долг закрыт»,
         и навязывать ей категорию до того, как о ней спросили, не нужно -->
    <ToggleRow
      v-model="countInAnalytics"
      data-testid="work-off-accounting"
      :title="accountingTitle"
      :description="accountingHint"
    />

    <CategoryChips
      v-if="categoryId !== null"
      :categories="workCategories"
      :selected-id="categoryId"
      :rows="1"
      searchable
      label="Категория работы"
      @select="categoryId = $event"
    />
  </div>
</template>
