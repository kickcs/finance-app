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
import { formatCurrency } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '../model/types';

withDefaults(
  defineProps<{
    open: boolean;
    accounts: AccountWithBalances[];
    selectedId: string | null;
    title?: string;
  }>(),
  { title: 'Выберите счёт' },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [accountId: string];
}>();

const isDesktop = useIsDesktop();

function pick(accountId: string) {
  emit('select', accountId);
  emit('update:open', false);
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
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark max-h-[70dvh]'
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
              {{ title }}
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
          class="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain"
          data-vaul-no-drag
        >
          <p
            v-if="accounts.length === 0"
            class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Нет доступных счетов
          </p>
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
            :class="
              account.id === selectedId
                ? 'bg-primary/10'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark'
            "
            @click="pick(account.id)"
          >
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: account.color }"
            />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium truncate"
                :class="
                  account.id === selectedId
                    ? 'text-primary'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                "
              >
                {{ account.name }}
              </p>
            </div>
            <span
              class="text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{
                formatCurrency(
                  account.balances[0]?.balance ?? 0,
                  account.balances[0]?.currency ?? '',
                )
              }}
              <template v-if="account.balances.length > 1">
                +{{ account.balances.length - 1 }}
              </template>
            </span>
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
