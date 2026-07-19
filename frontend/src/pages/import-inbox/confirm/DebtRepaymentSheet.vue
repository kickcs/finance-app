<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, IconBadge } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { formatCurrency } from '@/shared/lib/format/currency';
import { DEBT_DIRECTION_COLORS } from '@/entities/debt';
import { debtsCountLabel, type RepaymentGroup } from '../model/debtRepayment';

defineProps<{
  open: boolean;
  groups: RepaymentGroup[];
  amount: number;
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [group: RepaymentGroup];
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
              Погашение долга
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
          <p class="mt-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Зачесть {{ formatCurrency(amount, currency) }} — выберите, чей долг погасить
          </p>
        </div>

        <div
          class="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain"
          data-vaul-no-drag
        >
          <p
            v-if="groups.length === 0"
            class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Нет подходящих открытых долгов
          </p>
          <button
            v-for="group in groups"
            :key="`${group.personName}_${group.debtType}`"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark transition-colors text-left"
            @click="emit('select', group)"
          >
            <IconBadge icon="handshake" :color="DEBT_DIRECTION_COLORS[group.debtType]" />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ group.personName }}
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                <template v-if="group.debts.length > 1">
                  {{ debtsCountLabel(group.debts.length) }} · остаток
                  {{ formatCurrency(group.totalRemaining, group.currency) }}
                </template>
                <template v-else>
                  Остаток: {{ formatCurrency(group.totalRemaining, group.currency) }}
                </template>
              </p>
            </div>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
            />
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
