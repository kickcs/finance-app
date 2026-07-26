<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import type { FilterChip } from './FilterChips.vue';

defineProps<{
  open: boolean;
  items: FilterChip[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  toggle: [id: string];
  clear: [];
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
        data-testid="account-filter-sheet"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2 flex items-center justify-between" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Счета
          </DrawerTitle>
          <button
            v-if="selectedIds.length > 0"
            data-testid="account-filter-clear"
            class="text-body-sm text-primary transition-colors hover:text-primary-hover"
            @click="emit('clear')"
          >
            Сбросить
          </button>
        </div>

        <p class="px-5 pb-2 text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Без выбора аналитика считается по всем счетам.
        </p>

        <div class="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            :data-testid="`account-filter-option-${item.id}`"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
            :class="
              selectedIds.includes(item.id)
                ? 'bg-primary/10'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark'
            "
            @click="emit('toggle', item.id)"
          >
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :style="{ backgroundColor: item.color ?? 'var(--color-neutral)' }"
            />
            <span
              class="flex-1 min-w-0 truncate text-body-sm font-medium"
              :class="
                selectedIds.includes(item.id)
                  ? 'text-primary'
                  : 'text-text-primary-light dark:text-text-primary-dark'
              "
            >
              {{ item.name }}
            </span>
            <UIcon
              v-if="selectedIds.includes(item.id)"
              name="check"
              size="sm"
              class="text-primary shrink-0"
            />
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
