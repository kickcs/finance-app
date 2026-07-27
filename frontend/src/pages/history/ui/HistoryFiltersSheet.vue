<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UButton } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { AccountSelector } from '@/entities/account';
import type { AccountWithBalances } from '@/entities/account';
import { CategoryChips } from '@/entities/category';
import type { Category } from '@/entities/category';

defineProps<{
  open: boolean;
  accounts: AccountWithBalances[];
  categories: Category[];
  selectedAccountId: string | null;
  selectedCategoryId: string | null;
  activeCount: number;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:selectedAccountId': [value: string | null];
  'update:selectedCategoryId': [value: string | null];
  reset: [];
}>();

const isDesktop = useIsDesktop();
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
        data-testid="history-filters-sheet"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark max-h-[80dvh]'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <div class="flex items-center justify-between">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              Фильтры
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
        </div>

        <div
          class="flex-1 overflow-y-auto px-5 pb-4 space-y-5 overscroll-contain"
          data-vaul-no-drag
        >
          <AccountSelector
            v-if="accounts.length > 0"
            :accounts="accounts"
            :selected-id="selectedAccountId"
            label="Счёт"
            @select="emit('update:selectedAccountId', $event === selectedAccountId ? null : $event)"
          />
          <CategoryChips
            v-if="categories.length > 0"
            :categories="categories"
            :selected-id="selectedCategoryId ?? ''"
            :rows="3"
            searchable
            optional
            label="Категория"
            @select="
              emit('update:selectedCategoryId', $event === selectedCategoryId ? null : $event)
            "
          />
        </div>

        <div
          class="flex gap-2 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border-light dark:border-border-dark"
        >
          <UButton
            v-if="activeCount > 0"
            variant="ghost"
            class="flex-1"
            data-testid="sheet-reset-filters"
            @click="emit('reset')"
          >
            Сбросить
          </UButton>
          <UButton variant="primary" class="flex-1" @click="emit('update:open', false)">
            Показать
          </UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
