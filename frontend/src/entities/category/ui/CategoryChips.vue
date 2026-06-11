<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { UIcon, UInput } from '@/shared/ui';
import type { Category } from '@/entities/category';
import { useSlidingIndicator, buildIndicatorRect } from '@/shared/lib/hooks/useSlidingIndicator';

const props = withDefaults(
  defineProps<{
    categories: Category[];
    selectedId: string;
    label?: string;
    rows?: number;
    searchable?: boolean;
  }>(),
  { rows: 2 },
);

const emit = defineEmits<{
  select: [categoryId: string];
}>();

// Search across all categories (frequent + infrequent)
const searchActive = ref(false);
const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
const isSearching = computed(() => searchActive.value && normalizedQuery.value.length > 0);

function openSearch() {
  searchActive.value = true;
  nextTick(() => searchInputRef.value?.focus());
}

function closeSearch() {
  searchActive.value = false;
  searchQuery.value = '';
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeSearch();
}

// iOS: mousedown on a chip blurs the search input, the keyboard starts closing
// and the layout shifts before click is dispatched — the tap misses the chip.
// Keep focus until the click lands; closeSearch() will dismiss the keyboard.
function keepSearchFocus(event: MouseEvent) {
  if (searchActive.value) event.preventDefault();
}

// Category picked from search results is pinned to the front of the list
// until a different category is selected
const pinnedCategoryId = ref<string | null>(null);

function selectCategory(categoryId: string) {
  if (isSearching.value) {
    pinnedCategoryId.value = categoryId;
  } else if (categoryId !== pinnedCategoryId.value) {
    pinnedCategoryId.value = null;
  }
  emit('select', categoryId);
  if (searchActive.value) closeSearch();
}

// Split into frequent and infrequent (only when isFrequent is explicitly set)
const showInfrequent = ref(false);

const hasInfrequent = computed(() => props.categories.some((c) => c.isFrequent === false));

const frequentCategories = computed(() =>
  hasInfrequent.value ? props.categories.filter((c) => c.isFrequent !== false) : props.categories,
);

const infrequentCategories = computed(() =>
  hasInfrequent.value ? props.categories.filter((c) => c.isFrequent === false) : [],
);

// If selected category is infrequent, auto-expand (pinned one is already visible at the front)
watch(
  () => props.selectedId,
  (id) => {
    if (id !== pinnedCategoryId.value && infrequentCategories.value.some((c) => c.id === id)) {
      showInfrequent.value = true;
    }
  },
  { immediate: true },
);

const visibleCategories = computed(() => {
  if (isSearching.value) {
    return props.categories.filter((c) => c.name.toLowerCase().includes(normalizedQuery.value));
  }
  const base = showInfrequent.value
    ? [...frequentCategories.value, ...infrequentCategories.value]
    : frequentCategories.value;
  const pinned = props.categories.find((c) => c.id === pinnedCategoryId.value);
  if (!pinned) return base;
  return [pinned, ...base.filter((c) => c.id !== pinned.id)];
});

const categoryRows = computed(() => {
  const total = visibleCategories.value.length;
  const rowCount = Math.max(1, Math.min(props.rows, Math.ceil(total / 3)));
  const baseSize = Math.floor(total / rowCount);
  const remainder = total % rowCount;
  const result: Category[][] = [];
  let idx = 0;
  for (let i = 0; i < rowCount; i++) {
    // Front-load: first rows get one extra item
    const size = baseSize + (i < remainder ? 1 : 0);
    result.push(visibleCategories.value.slice(idx, idx + size));
    idx += size;
  }
  return result;
});

const containerRef = ref<HTMLElement | null>(null);

const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  () => props.selectedId,
  (containerRect, activeRect, scrollLeft, scrollTop) => {
    const category = props.categories.find((c) => c.id === props.selectedId);
    return {
      ...buildIndicatorRect(containerRect, activeRect, scrollLeft, scrollTop),
      backgroundColor: category ? `${category.color}15` : 'transparent',
      borderColor: category ? category.color : 'transparent',
    };
  },
);

watch(
  () => props.categories,
  () => nextTick(updateIndicator),
  { deep: true },
);

watch(showInfrequent, () => nextTick(updateIndicator));

watch([searchActive, normalizedQuery, pinnedCategoryId], () => nextTick(updateIndicator));

function getChipStyle(category: Category) {
  if (category.id === props.selectedId) {
    return {
      color: category.color,
      borderColor: 'transparent', // Border handled by indicator
    };
  }
  return {};
}

function toggleInfrequent() {
  showInfrequent.value = !showInfrequent.value;
}
</script>

<template>
  <div>
    <div v-if="label || searchable" class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          {{ label }}
        </span>
        <span
          v-if="!selectedId"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          — выберите
        </span>
      </div>
      <button
        v-if="searchable"
        type="button"
        :aria-label="searchActive ? 'Закрыть поиск категорий' : 'Поиск категории'"
        class="flex items-center gap-1 -my-1 px-1.5 py-1 rounded-md text-xs text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark active:scale-95 transition-all"
        @mousedown="keepSearchFocus"
        @click="searchActive ? closeSearch() : openSearch()"
      >
        <UIcon :name="searchActive ? 'close' : 'search'" size="xs" />
        {{ searchActive ? 'Закрыть' : 'Поиск' }}
      </button>
    </div>

    <Transition name="search-fade">
      <UInput
        v-if="searchActive"
        ref="searchInputRef"
        v-model="searchQuery"
        variant="search"
        placeholder="Поиск категории..."
        class="mb-2"
        data-testid="category-search-input"
        @keydown="handleSearchKeydown"
      />
    </Transition>

    <p
      v-if="isSearching && visibleCategories.length === 0"
      class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark py-2"
    >
      Ничего не найдено
    </p>

    <div
      v-show="!(isSearching && visibleCategories.length === 0)"
      ref="containerRef"
      class="relative overflow-x-auto no-scrollbar -mx-4 px-4 pb-1"
    >
      <!-- Sliding Indicator -->
      <span
        class="absolute rounded-lg pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 border"
        :style="indicatorStyle"
      />

      <div class="flex flex-col gap-1.5 w-max chips-grid">
        <div v-for="(row, rowIdx) in categoryRows" :key="rowIdx" class="flex gap-1.5">
          <button
            v-for="category in row"
            :key="category.id"
            :ref="(el) => setChipRef(category.id, el as HTMLElement)"
            type="button"
            class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-colors duration-300 whitespace-nowrap"
            :class="
              category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                : ''
            "
            :style="getChipStyle(category)"
            @mousedown="keepSearchFocus"
            @click="selectCategory(category.id)"
          >
            <UIcon :name="category.icon" size="sm" :style="{ color: category.color }" />
            {{ category.name }}
          </button>

          <!-- Toggle infrequent chip at the end of the last row -->
          <button
            v-if="hasInfrequent && !isSearching && rowIdx === categoryRows.length - 1"
            type="button"
            class="relative z-10 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-dashed border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark active:scale-95 transition-colors duration-300 whitespace-nowrap"
            @mousedown="keepSearchFocus"
            @click="toggleInfrequent"
          >
            <UIcon :name="showInfrequent ? 'expand_less' : 'expand_more'" size="sm" />
            {{ showInfrequent ? 'Скрыть' : `Ещё ${infrequentCategories.length}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chips-grid {
  transition: opacity 0.15s ease;
}

.search-fade-enter-active {
  transition: all 0.15s ease-out;
}

.search-fade-leave-active {
  transition: all 0.1s ease-in;
}

.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
