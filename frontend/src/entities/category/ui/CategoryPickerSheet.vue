<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { UIcon, UInput, IconBadge } from '@/shared/ui';
import { UOverlay } from '@/shared/ui/overlay';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import type { Category } from '../model/types';
import { searchCategories } from '../model/categorySearch';

const props = defineProps<{
  open: boolean;
  categories: Category[];
  selectedId: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [categoryId: string];
}>();

const isDesktop = useIsDesktop();
const router = useRouter();

const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

const filtered = computed(() => searchCategories(props.categories, searchQuery.value));
const isSearching = computed(() => searchQuery.value.trim().length > 0);

// При открытии: сброс поиска; autofocus только на desktop —
// на мобиле клавиатура сразу съела бы пол-шита. Клавиатурный хак для мобилы
// теперь внутри UOverlay — здесь им управлять больше не нужно.
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    searchQuery.value = '';
    await nextTick();
    if (!props.open) return;
    if (isDesktop.value) searchInputRef.value?.focus();
  },
);

function handleSelect(categoryId: string) {
  emit('select', categoryId);
}

// Enter (кнопка «Готово» на мобильной клавиатуре) выбирает первое совпадение
function handleEnter() {
  const first = filtered.value[0];
  if (isSearching.value && first) handleSelect(first.id);
}

// iOS: mousedown по плитке блюрит поиск, клавиатура начинает закрываться и
// layout шита сдвигается до dispatch click — тап промахивается (см. CategoryChips).
// Гасим mousedown: фокус (и клавиатура) держатся, пока click не долетит.
function keepSearchFocus(event: MouseEvent) {
  event.preventDefault();
}

function toManageCategories() {
  emit('update:open', false);
  router.push({ name: ROUTE_NAMES.SETTINGS_CATEGORIES });
}
</script>

<template>
  <UOverlay
    :model-value="open"
    title="Категория"
    desktop="dialog"
    @update:model-value="emit('update:open', $event)"
  >
    <!-- Поиск: sticky над сеткой, чтобы не уезжал при скролле длинного списка -->
    <div class="sticky -top-4 -mx-5 -mt-4 z-10 bg-card-light dark:bg-card-dark px-5 pt-4 pb-3">
      <UInput
        ref="searchInputRef"
        v-model="searchQuery"
        variant="search"
        placeholder="Поиск категории..."
        data-testid="category-sheet-search"
        @keydown.enter="handleEnter"
      />
    </div>

    <div v-if="filtered.length === 0" class="flex flex-col items-center gap-3 py-8 text-center">
      <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">Ничего не найдено</p>
    </div>

    <div v-else role="radiogroup" aria-label="Все категории" class="grid grid-cols-4 gap-2">
      <button
        v-for="(category, idx) in filtered"
        :key="category.id"
        type="button"
        role="radio"
        :aria-checked="category.id === selectedId"
        class="flex flex-col items-center gap-1.5 px-1 py-2 rounded-xl border transition-colors min-h-[76px]"
        :class="
          category.id === selectedId
            ? ''
            : isSearching && idx === 0
              ? 'border-primary/40 bg-primary/[0.04]'
              : 'border-transparent hover:bg-surface-light dark:hover:bg-surface-dark'
        "
        :style="
          category.id === selectedId
            ? { borderColor: category.color, backgroundColor: category.color + '10' }
            : undefined
        "
        @mousedown="keepSearchFocus"
        @click="handleSelect(category.id)"
      >
        <IconBadge :icon="category.icon" :color="category.color" size="lg" />
        <span
          class="text-xs text-center leading-tight line-clamp-2 text-text-primary-light dark:text-text-primary-dark"
        >
          {{ category.name }}
        </span>
      </button>
    </div>

    <template #footer>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
        @mousedown="keepSearchFocus"
        @click="toManageCategories"
      >
        <UIcon name="settings" size="sm" />
        Управление категориями
      </button>
    </template>
  </UOverlay>
</template>
