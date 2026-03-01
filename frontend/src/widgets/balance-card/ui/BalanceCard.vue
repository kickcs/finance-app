<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';

defineProps<{
  totalBalance: number;
  currency: string;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'toggle-hidden': [];
  'balance-click': [];
}>();
</script>

<template>
  <div
    class="relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 sm:p-8 shadow-sm group hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
    <!-- Decorative Ambient Glow (Primary Color) -->
    <div
      class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 dark:bg-primary/20 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/25 transition-colors duration-500 ease-out"
    ></div>
    <div
      class="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-primary/10 dark:bg-primary/10 blur-[50px] pointer-events-none group-hover:bg-primary/15 dark:group-hover:bg-primary/15 transition-colors duration-500 ease-out"
    ></div>

    <div class="relative z-10 flex flex-col md:flex-row justify-between gap-6">
      <!-- Left Side: Balance Info -->
      <div class="flex flex-col items-center md:items-start text-center md:text-left w-full">
        <!-- Balance Label -->
        <div class="flex items-center justify-center md:justify-start gap-2 mb-3">
          <div
            class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="account_balance_wallet" size="xs" />
          </div>
          <p
            class="text-sm font-semibold tracking-wide text-text-secondary-light dark:text-text-secondary-dark uppercase"
          >
            Общий баланс
          </p>
          <button
            :aria-label="hidden ? 'Показать баланс' : 'Скрыть баланс'"
            class="p-1.5 ml-1 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-all duration-200"
            @click.stop="$emit('toggle-hidden')"
          >
            <UIcon :name="hidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>

        <!-- Loading skeleton -->
        <Skeleton v-if="loading" class="h-12 w-[200px] sm:w-[280px] rounded-xl mb-3" />

        <!-- Balance amount -->
        <Transition
          enter-active-class="transition-opacity duration-300 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
        >
          <button
            v-if="!loading"
            type="button"
            aria-label="Перейти к счетам"
            class="group/btn w-full flex items-center justify-center md:justify-start outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-dark"
            @click="$emit('balance-click')"
          >
            <h1
              class="text-4xl sm:text-[3.5rem] font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight"
            >
              {{ formatMasked(totalBalance, currency, hidden ?? false, COMPACT_FORMAT) }}
            </h1>
          </button>
        </Transition>
      </div>

      <!-- Right Side (Desktop Only): 'К счетам' Button -->
      <div class="hidden md:flex shrink-0 mt-2">
        <button
          type="button"
          aria-label="Перейти ко всем счетам"
          class="group/nav flex items-center gap-2 h-10 text-sm font-semibold text-primary hover:text-primary-hover transition-colors px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20"
          @click="$emit('balance-click')"
        >
          К счетам
          <UIcon
            name="arrow_forward"
            size="sm"
            class="transition-transform group-hover/nav:translate-x-1"
          />
        </button>
      </div>
    </div>
  </div>
</template>
