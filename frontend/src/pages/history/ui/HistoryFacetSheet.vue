<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UOverlay, UButton } from '@/shared/ui';
import { DatePickerField } from '@/shared/ui/date-picker';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { stripHash, type Hashtag } from '@/entities/transaction';
import { opsAccusative } from '@/features/bulk-edit-transactions';
import { PERIOD_PRESETS, type HistoryPeriod, type PeriodPreset } from '../lib/historyPeriod';
import { FACETS, type FacetName, type FacetValues } from '../model/facets';
import HistoryFacetOption from './HistoryFacetOption.vue';

const props = defineProps<{
  /** Категории, доступные на текущей вкладке типа. */
  categories: Category[];
  accounts: AccountWithBalances[];
  /** Теги пользователя с числом использований. */
  hashtags: Hashtag[];
  /** Сколько операций даёт текущий фильтр; пока неизвестно — на кнопке просто «Показать». */
  resultCount?: number;
}>();

const emit = defineEmits<{ clear: [facet: FacetName] }>();

// Открытый чип одновременно и признак «шторка открыта».
const facet = defineModel<FacetName | null>('facet', { required: true });
const values = defineModel<FacetValues>('values', { required: true });

const period = computed(() => values.value.period);
function update(partial: Partial<FacetValues>) {
  values.value = { ...values.value, ...partial };
}

// На закрытии шторка ещё несколько кадров уезжает вниз — содержимое не должно
// пустеть, пока она это делает.
const shownFacet = ref<FacetName>('period');
watch(
  facet,
  (value) => {
    if (value) shownFacet.value = value;
  },
  { immediate: true },
);

const isOpen = computed({
  get: () => facet.value !== null,
  set: (open: boolean) => {
    if (!open) facet.value = null;
  },
});

// Календарь портируем внутрь шторки: в портале на body тап по нему читается
// как клик снаружи, и шторка закрывается вместе с выбором даты.
const overlayRef = ref<{ contentEl?: HTMLElement | null } | null>(null);
const datePortalTarget = computed(() => overlayRef.value?.contentEl ?? null);

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

type ListFacet = 'categoryIds' | 'tags' | 'accountIds';
function toggle(key: ListFacet, id: string) {
  update({ [key]: toggleId(values.value[key], id) });
}

/** Выбранный, но давно не встречающийся тег остаётся в списке, иначе его было бы нечем снять. */
const tagOptions = computed(() => {
  const known = props.hashtags.map((h) => ({ tag: stripHash(h.tag), count: h.count }));
  const missing = values.value.tags
    .filter((tag) => !known.some((k) => k.tag === tag))
    .map((tag) => ({ tag, count: undefined }));
  return [...known, ...missing];
});

function togglePreset(id: PeriodPreset) {
  // Повторный тап по выбранному пункту снимает период.
  update({ period: period.value?.preset === id ? null : { preset: id, from: null, to: null } });
}

function setBound(bound: 'from' | 'to', value: string | null) {
  const base = period.value?.preset === 'custom' ? period.value : { from: null, to: null };
  const next: HistoryPeriod = { preset: 'custom', from: base.from, to: base.to, [bound]: value };
  update({ period: next });
}

const hasSelection = computed(() => FACETS[shownFacet.value].isSet(values.value));

const showLabel = computed(() => {
  const n = props.resultCount;
  if (n === undefined) return 'Показать';
  if (n === 0) return 'Ничего не найдено';
  return `Показать ${opsAccusative(n)}`;
});
</script>

<template>
  <UOverlay ref="overlayRef" v-model="isOpen" :title="FACETS[shownFacet].title" desktop="panel">
    <div data-testid="history-facet-sheet" :data-facet="shownFacet">
      <div v-if="shownFacet === 'period'" role="radiogroup" aria-label="Период">
        <HistoryFacetOption
          v-for="preset in PERIOD_PRESETS"
          :key="preset.id"
          :label="preset.label"
          shape="round"
          :selected="period?.preset === preset.id"
          @click="togglePreset(preset.id)"
        />
        <HistoryFacetOption
          label="Свой период"
          shape="round"
          :selected="period?.preset === 'custom'"
          @click="togglePreset('custom')"
        />
        <div v-if="period?.preset === 'custom'" class="grid grid-cols-2 gap-3 pb-1 pt-3">
          <div v-for="bound in ['from', 'to'] as const" :key="bound" class="flex flex-col gap-1.5">
            <span
              class="ml-0.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              {{ bound === 'from' ? 'С' : 'По' }}
            </span>
            <DatePickerField
              variant="chip"
              clearable
              placeholder="Не выбрано"
              :model-value="period[bound]"
              :aria-label="bound === 'from' ? 'Начало периода' : 'Конец периода'"
              :portal-to="datePortalTarget"
              @update:model-value="setBound(bound, $event)"
            />
          </div>
        </div>
      </div>

      <div v-else-if="shownFacet === 'category'" role="group" aria-label="Категория">
        <HistoryFacetOption
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          shape="square"
          :icon="category.icon"
          :color="category.color"
          :selected="values.categoryIds.includes(category.id)"
          @click="toggle('categoryIds', category.id)"
        />
      </div>

      <div v-else-if="shownFacet === 'tag'" role="group" aria-label="Тег">
        <HistoryFacetOption
          v-for="option in tagOptions"
          :key="option.tag"
          :label="`#${option.tag}`"
          shape="square"
          :count="option.count"
          :selected="values.tags.includes(option.tag)"
          @click="toggle('tags', option.tag)"
        />
        <p
          v-if="tagOptions.length === 0"
          class="py-6 text-center text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Тегов пока нет
        </p>
      </div>

      <div v-else role="group" aria-label="Счёт">
        <HistoryFacetOption
          v-for="account in accounts"
          :key="account.id"
          :label="account.name"
          shape="square"
          :color="account.color"
          :selected="values.accountIds.includes(account.id)"
          @click="toggle('accountIds', account.id)"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <UButton
          v-if="shownFacet !== 'period'"
          variant="secondary"
          :disabled="!hasSelection"
          data-testid="facet-reset"
          @click="emit('clear', shownFacet)"
        >
          Сбросить
        </UButton>
        <UButton variant="primary" class="flex-1" data-testid="facet-show" @click="isOpen = false">
          {{ showLabel }}
        </UButton>
      </div>
    </template>
  </UOverlay>
</template>
