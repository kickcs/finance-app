<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';

defineProps<{
  totalBalance: number;
  currency: string;
  avgDailyExpense?: number | null;
  safeDailyLimit?: number | null;
  daysRemaining?: number;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'toggle-hidden': [];
  'balance-click': [];
}>();

const metricLabel =
  'text-[0.6rem] font-semibold tracking-wide uppercase text-text-tertiary-light dark:text-text-tertiary-dark';
const metricSub = 'text-[0.6rem] font-medium text-text-tertiary-light dark:text-text-tertiary-dark';
</script>

<template>
  <div
    class="balance-card relative overflow-hidden rounded-2xl bg-card-light dark:bg-card-dark p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
    <div class="relative z-10 flex items-center justify-between gap-4">
      <!-- Left Side: Balance -->
      <div class="flex flex-col min-w-0">
        <!-- Balance Label + Eye Toggle -->
        <div class="flex items-center gap-2 mb-1.5">
          <div
            class="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="account_balance_wallet" size="xs" />
          </div>
          <p
            class="text-xs font-semibold tracking-wide text-text-secondary-light dark:text-text-secondary-dark uppercase"
          >
            Баланс
          </p>
          <button
            :aria-label="hidden ? 'Показать баланс' : 'Скрыть баланс'"
            class="p-1 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-all duration-200"
            @click.stop="$emit('toggle-hidden')"
          >
            <UIcon :name="hidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>

        <!-- Balance Amount -->
        <Skeleton v-if="loading" class="h-9 w-[180px] rounded-xl" />
        <button
          v-else
          type="button"
          aria-label="Перейти к счетам"
          class="group/btn flex items-center outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          @click="$emit('balance-click')"
        >
          <span
            class="text-xl sm:text-2xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight"
          >
            {{ formatMasked(totalBalance, currency, hidden ?? false) }}
          </span>
        </button>
      </div>

      <!-- Divider -->
      <div
        v-if="loading || avgDailyExpense != null"
        class="w-px self-stretch my-1 bg-border-light dark:bg-border-dark"
      />

      <!-- Right Side: Spending Metrics -->
      <div
        v-if="loading || avgDailyExpense != null"
        class="flex flex-col items-end shrink-0 gap-1.5"
      >
        <!-- Loading skeleton -->
        <template v-if="loading">
          <Skeleton class="h-3 w-16 rounded" />
          <Skeleton class="h-5 w-24 rounded-lg" />
          <Skeleton class="h-3 w-16 rounded" />
          <Skeleton class="h-5 w-24 rounded-lg" />
          <Skeleton class="h-2.5 w-20 rounded" />
        </template>

        <!-- Loaded metrics -->
        <template v-else>
          <!-- Average daily expense -->
          <div class="flex flex-col items-end">
            <p :class="metricLabel">Средний расход</p>
            <span class="text-sm font-bold text-warning leading-tight">
              {{ formatMasked(avgDailyExpense!, currency, hidden ?? false) }}/дн
            </span>
          </div>

          <!-- Safe daily balance -->
          <div v-if="safeDailyLimit != null" class="flex flex-col items-end">
            <p :class="metricLabel">Безопасный остаток</p>
            <span
              class="text-sm font-bold leading-tight"
              :class="safeDailyLimit >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ formatMasked(safeDailyLimit, currency, hidden ?? false) }}/дн
            </span>
          </div>

          <span v-if="daysRemaining != null" :class="metricSub">
            осталось {{ daysRemaining }} дн
          </span>
        </template>
      </div>

      <!-- Desktop: 'К счетам' Button -->
      <div class="hidden md:flex shrink-0">
        <button
          type="button"
          aria-label="Перейти ко всем счетам"
          class="group/nav flex items-center gap-2 h-9 text-sm font-semibold text-primary hover:text-primary-hover transition-colors px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20"
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

<style scoped>
.balance-card::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 85%;
  height: 85%;
  translate: -50% -50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-primary) 15%, transparent),
    color-mix(in srgb, var(--color-primary) 5%, transparent)
  );
  filter: blur(45px);
  opacity: 0.5;
  border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%;
  animation: morph-blob 12s ease-in-out infinite;
  will-change: transform;
  pointer-events: none;
}

:where(.dark) .balance-card::before {
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-primary) 25%, transparent),
    color-mix(in srgb, var(--color-primary) 10%, transparent)
  );
  opacity: 0.6;
}

.balance-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  padding: 2.5px;
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 30%, transparent) 25%,
    transparent 50%
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  animation: rotate-border 10s linear infinite;
  pointer-events: none;
}

:where(.dark) .balance-card::after {
  background: conic-gradient(
    from var(--border-angle),
    transparent 0%,
    color-mix(in srgb, var(--color-primary) 40%, transparent) 25%,
    transparent 50%
  );
}

@media (prefers-reduced-motion: reduce) {
  .balance-card::before,
  .balance-card::after {
    animation: none;
  }
}

@keyframes morph-blob {
  0%,
  100% {
    border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%;
  }
  17% {
    border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%;
  }
  33% {
    border-radius: 67% 33% 47% 53% / 37% 20% 80% 63%;
  }
  50% {
    border-radius: 100%;
  }
  67% {
    border-radius: 50% 50% 53% 47% / 26% 22% 78% 74%;
  }
  83% {
    border-radius: 20% 80% 20% 80% / 20% 80% 20% 80%;
  }
}

@keyframes rotate-border {
  to {
    --border-angle: 360deg;
  }
}
</style>
