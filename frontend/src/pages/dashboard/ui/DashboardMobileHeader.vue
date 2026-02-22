<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { ThemeToggle } from '@/features/toggle-theme';
import { UIcon } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';

defineProps<{
  userName: string;
  greeting: string;
  totalBalance: number;
  currency: string;
  isHidden: boolean;
  isScrolledPastBalance: boolean;
}>();

const emit = defineEmits<{
  'profile-click': [];
}>();
</script>

<template>
  <div class="md:hidden shrink-0">
    <AppHeader>
      <template #logo>
        <button
          type="button"
          aria-label="Перейти в профиль"
          class="relative w-[200px] h-10 cursor-pointer overflow-hidden"
          @click="emit('profile-click')"
        >
          <!-- Default Greeting State -->
          <div
            :aria-hidden="isScrolledPastBalance"
            class="absolute inset-0 flex items-center gap-2.5 group transition-[transform,opacity] duration-300 ease-out"
            :class="
              isScrolledPastBalance
                ? '-translate-y-full opacity-0 pointer-events-none'
                : 'translate-y-0 opacity-100'
            "
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover shadow-sm shadow-primary/25 group-hover:shadow-md group-hover:shadow-primary/30 group-hover:scale-105 transition-[transform,box-shadow] duration-200 shrink-0"
            >
              <span class="text-white font-bold text-base">
                {{ userName ? userName[0].toUpperCase() : 'O' }}
              </span>
            </div>
            <div class="flex flex-col">
              <span
                class="text-xs text-text-secondary-light dark:text-text-secondary-dark leading-tight"
              >
                {{ greeting }}
              </span>
              <span
                class="font-bold text-base text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors leading-tight truncate max-w-[140px]"
              >
                {{ userName || 'Ouro' }}
              </span>
            </div>
          </div>

          <!-- Sticky Balance State -->
          <div
            :aria-hidden="!isScrolledPastBalance"
            class="absolute inset-0 flex items-center gap-2.5 transition-[transform,opacity] duration-300 ease-out"
            :class="
              isScrolledPastBalance
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none'
            "
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shrink-0"
            >
              <UIcon name="account_balance_wallet" size="sm" class="text-primary" />
            </div>
            <div class="flex flex-col justify-center">
              <span
                class="text-caption-sm uppercase font-semibold tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark leading-none mb-1"
              >
                Общий баланс
              </span>
              <span
                class="font-bold text-sm text-text-primary-light dark:text-text-primary-dark leading-none tracking-tight"
              >
                {{ formatMasked(totalBalance, currency, isHidden, COMPACT_FORMAT) }}
              </span>
            </div>
          </div>
        </button>
      </template>
      <template #actions>
        <ThemeToggle />
      </template>
    </AppHeader>
  </div>
</template>
