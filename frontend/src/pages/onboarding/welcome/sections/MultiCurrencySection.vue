<script setup lang="ts">
import { ref } from 'vue';
import { useSectionAnimation, useCountUp } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();

const accounts = [
  {
    icon: '💳',
    name: 'Visa Gold',
    accent: 'from-indigo-500 to-violet-500',
    amount: 4200,
    currency: '$',
    sub: '€1,850 · ₽25,000',
  },
  {
    icon: '🏦',
    name: 'Сбережения',
    accent: 'from-emerald-500 to-teal-400',
    amount: 8500,
    currency: '€',
    sub: 'Депозит 6%',
  },
  {
    icon: '💵',
    name: 'Наличные',
    accent: 'from-amber-500 to-orange-400',
    amount: 500000,
    currency: '',
    sub: 'UZS',
    formatSuffix: ' сўм',
  },
];

const displayAmounts = accounts.map((acc) => {
  const target = ref(acc.amount);
  return useCountUp(target, isVisible, {
    duration: 1200,
    format: (n) => {
      const formatted = Math.floor(n).toLocaleString('en-US');
      return `${acc.currency}${formatted}${acc.formatSuffix ?? ''}`;
    },
  });
});
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Мульти-валюта"
    style="background: linear-gradient(170deg, #080e1c 0%, #0d1526 50%, #111827 100%)"
  >
    <!-- Ambient glow -->
    <div
      class="absolute left-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-cyan-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-12 text-center">
        <p
          class="mb-3 text-[10px] font-medium uppercase tracking-[4px] text-cyan-400/70 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        >
          Мульти-валюта
        </p>
        <h2
          class="mb-3 text-3xl font-black text-white transition-all duration-600 sm:text-4xl"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.1s' }"
        >
          Все валюты — один счёт
        </h2>
        <p
          class="text-sm text-white/35 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.15s' }"
        >
          Храните USD, EUR, UZS и ещё 3 валюты на одном счёте
        </p>
      </div>

      <!-- Account cards -->
      <div class="flex flex-wrap justify-center gap-4">
        <div
          v-for="(acc, i) in accounts"
          :key="i"
          class="glass-card gradient-border w-44 rounded-2xl p-4 text-left transition-all duration-600 sm:w-48"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
          :style="{ transitionDelay: `${0.2 + i * 0.12}s` }"
        >
          <div class="mb-3 flex items-center gap-2">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-sm"
              :class="acc.accent"
            >
              {{ acc.icon }}
            </div>
            <span class="text-xs font-semibold text-white">{{ acc.name }}</span>
          </div>
          <p class="font-['Unbounded'] text-lg font-bold text-white">
            {{ displayAmounts[i].value }}
          </p>
          <p class="mt-1 text-[10px] text-white/30">{{ acc.sub }}</p>
        </div>
      </div>

      <!-- Exchange rate bar -->
      <div
        class="mx-auto mt-8 max-w-md transition-all duration-600"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.6s' }"
      >
        <div class="glass-card rounded-xl px-5 py-3 text-center">
          <p class="text-xs text-cyan-300/60">$1 = 12,850 сўм · €0.92 · ₽89.5</p>
          <p class="mt-0.5 text-[9px] text-white/20">Курсы обновляются автоматически</p>
        </div>
      </div>
    </div>
  </section>
</template>
