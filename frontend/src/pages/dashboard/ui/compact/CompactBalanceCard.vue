<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { useDashboardContext } from '../../model/dashboardContext';

const { totalBalance, currency, isHidden, balanceLoading, toggleHidden, nav } =
  useDashboardContext();
</script>

<template>
  <section
    class="morph-border-card compact-balance-card rounded-2xl bg-card-light dark:bg-card-dark p-4 shadow-sm transition-all duration-300 md:hover:-translate-y-0.5 md:hover:shadow-md"
  >
    <div class="relative z-10 flex items-center gap-3">
      <div
        class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0"
      >
        <UIcon name="account_balance_wallet" size="xs" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p
            class="text-caption-sm font-semibold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase"
          >
            Баланс
          </p>
          <button
            :aria-label="isHidden ? 'Показать баланс' : 'Скрыть баланс'"
            class="p-0.5 rounded-md text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-all duration-200"
            @click.stop="toggleHidden"
          >
            <UIcon :name="isHidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>
        <button
          v-if="!balanceLoading"
          type="button"
          aria-label="Перейти к счетам"
          class="group/btn flex items-center outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          @click="nav.toAccounts"
        >
          <span
            class="text-lg sm:text-xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight tabular-nums"
          >
            {{ formatMasked(totalBalance, currency, isHidden) }}
          </span>
        </button>
        <Skeleton v-else class="h-6 w-[140px] rounded-lg mt-0.5" />
      </div>
      <UIcon
        name="chevron_right"
        size="sm"
        class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
      />
    </div>
  </section>
</template>

<style scoped>
/* Compact variant tuning — smaller blob, slightly less intense glow.
   Keyframes + pseudo-element layout live in app/styles/index.css. */
.compact-balance-card {
  --morph-radius: 1rem;
  --morph-blob-size: 80%;
  --morph-blob-blur: 40px;
  --morph-blob-opacity: 0.45;
  --morph-blob-opacity-dark: 0.55;
  --morph-border-inset: 2px;
  --morph-border-alpha: 30%;
  --morph-border-alpha-dark: 40%;
}
</style>
