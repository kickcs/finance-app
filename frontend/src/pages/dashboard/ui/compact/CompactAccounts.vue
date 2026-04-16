<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '@/entities/account';
import { useDashboardContext } from '../../model/dashboardContext';
import { SECTION_LABEL_CLASS, VIEW_ALL_BTN_CLASS, iconTileStyle } from './constants';

const { visibleAccounts, accountsLoading, hiddenAccountCount, isHidden, nav } =
  useDashboardContext();

function accountBalance(account: AccountWithBalances): string {
  const balance = account.balances?.[0];
  if (!balance) return '0';
  return formatMasked(balance.balance, balance.currency, isHidden.value, COMPACT_FORMAT);
}
</script>

<template>
  <section data-testid="compact-accounts" class="-mx-4 px-4">
    <div class="flex items-center justify-between mb-1.5 px-0.5">
      <p :class="SECTION_LABEL_CLASS">
        Счета
        <span
          v-if="hiddenAccountCount > 0"
          class="ml-1 normal-case font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          · скрыто {{ hiddenAccountCount }}
        </span>
      </p>
      <button type="button" :class="VIEW_ALL_BTN_CLASS" @click="nav.toAccounts">Все</button>
    </div>
    <div class="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
      <template v-if="accountsLoading">
        <Skeleton
          v-for="i in 3"
          :key="`acc-sk-${i}`"
          class="shrink-0 h-[60px] w-[130px] rounded-xl"
        />
      </template>
      <template v-else>
        <button
          v-for="account in visibleAccounts"
          :key="account.id"
          type="button"
          :aria-label="`Счёт ${account.name}`"
          class="shrink-0 snap-start flex items-center gap-2.5 min-w-[130px] max-w-[180px] px-3 py-2.5 rounded-xl bg-card-light dark:bg-card-dark shadow-sm transition-all duration-200 md:hover:-translate-y-0.5 md:hover:shadow-md active:scale-[0.98]"
          @click="nav.toAccount(account)"
        >
          <div
            class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            :style="iconTileStyle(account.color)"
          >
            <UIcon :name="account.icon" size="xs" :style="{ color: account.color }" />
          </div>
          <div class="flex-1 text-left min-w-0">
            <p
              class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark truncate"
            >
              {{ account.name }}
            </p>
            <p
              class="text-xs font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ accountBalance(account) }}
            </p>
          </div>
        </button>
        <button
          type="button"
          aria-label="Добавить счёт"
          class="shrink-0 snap-start flex items-center justify-center gap-1.5 min-w-[110px] px-3 py-2.5 rounded-xl border border-dashed border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:border-primary/40 transition-all duration-200"
          @click="nav.toNewAccount"
        >
          <UIcon name="add" size="sm" />
          <span class="text-xs font-semibold">Добавить</span>
        </button>
      </template>
    </div>
  </section>
</template>
