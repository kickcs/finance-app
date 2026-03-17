<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';

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
    class="balance-card relative overflow-hidden rounded-[2rem] bg-card-light dark:bg-card-dark p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
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
              class="text-2xl sm:text-4xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight"
            >
              {{ formatMasked(totalBalance, currency, hidden ?? false) }}
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

<style scoped>
.balance-card::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 65%;
  height: 65%;
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
  border-radius: 2rem;
  padding: 1.5px;
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
