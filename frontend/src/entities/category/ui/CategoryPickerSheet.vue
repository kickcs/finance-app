<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UInput, IconBadge } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
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

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

const filtered = computed(() => searchCategories(props.categories, searchQuery.value));
const isSearching = computed(() => searchQuery.value.trim().length > 0);

// При открытии: сброс поиска; autofocus только на desktop —
// на мобиле клавиатура сразу съела бы пол-шита
watch(
  () => props.open,
  async (open) => {
    if (open) {
      searchQuery.value = '';
      await nextTick();
      if (!props.open) return;
      if (isDesktop.value) searchInputRef.value?.focus();
      else setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
    }
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
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark h-[85dvh]'
        "
      >
        <!-- Handle (mobile only) -->
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Категория
          </DrawerTitle>
          <button
            type="button"
            aria-label="Закрыть"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @click="emit('update:open', false)"
          >
            <UIcon name="close" size="sm" />
          </button>
        </div>

        <!-- Search (sticky над скроллом) -->
        <div class="px-5 pb-3">
          <UInput
            ref="searchInputRef"
            v-model="searchQuery"
            variant="search"
            placeholder="Поиск категории..."
            data-testid="category-sheet-search"
            @keydown.enter="handleEnter"
          />
        </div>

        <!-- Scrollable grid -->
        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto px-5 pb-4 overscroll-contain"
          data-vaul-no-drag
        >
          <div
            v-if="filtered.length === 0"
            class="flex flex-col items-center gap-3 py-8 text-center"
          >
            <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
              Ничего не найдено
            </p>
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
        </div>

        <!-- Footer: управление категориями -->
        <div ref="footerRef" class="px-5 py-3 border-t border-border-light dark:border-border-dark">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @mousedown="keepSearchFocus"
            @click="toManageCategories"
          >
            <UIcon name="settings" size="sm" />
            Управление категориями
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
