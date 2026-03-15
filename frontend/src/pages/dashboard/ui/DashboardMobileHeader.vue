<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { ThemeToggle } from '@/features/toggle-theme';
import { UIcon, DiscoveryDot } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';

defineProps<{
  userName: string;
  greeting: string;
  totalBalance: number;
  currency: string;
  isHidden: boolean;
  isScrolledPastBalance: boolean;
  showSettingsDot?: boolean;
}>();

const emit = defineEmits<{
  'profile-click': [];
  'settings-click': [];
  'balance-click': [];
}>();
</script>

<template>
  <div class="md:hidden shrink-0">
    <AppHeader>
      <template #logo>
        <div class="relative w-[200px] h-10 overflow-hidden">
          <!-- Default Greeting State -->
          <button
            type="button"
            aria-label="Перейти в профиль"
            :aria-hidden="isScrolledPastBalance"
            class="absolute inset-0 flex items-center gap-2.5 group transition-[transform,opacity] duration-300 ease-out cursor-pointer"
            :class="
              isScrolledPastBalance
                ? '-translate-y-full opacity-0 pointer-events-none'
                : 'translate-y-0 opacity-100'
            "
            @click="emit('profile-click')"
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
          </button>

          <!-- Sticky Balance State -->
          <button
            type="button"
            aria-label="Перейти к счетам"
            :aria-hidden="!isScrolledPastBalance"
            class="absolute inset-0 flex items-center gap-2.5 transition-[transform,opacity] duration-300 ease-out cursor-pointer"
            :class="
              isScrolledPastBalance
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none'
            "
            @click="emit('balance-click')"
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 dark:bg-primary/20 shrink-0 border border-primary/10"
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
          </button>
        </div>
      </template>
      <template #actions>
        <div class="relative">
          <button
            type="button"
            aria-label="Настройки дашборда"
            class="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @click="emit('settings-click')"
          >
            <UIcon name="tune" size="sm" />
          </button>
          <DiscoveryDot :show="showSettingsDot" />
        </div>
        <ThemeToggle />
      </template>
    </AppHeader>
  </div>
</template>
