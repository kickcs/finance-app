<script setup lang="ts">
import { ref } from 'vue';
import { useSectionAnimation, useCountUp } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();

const accounts = [
  {
    icon: '💳',
    name: 'Visa Gold',
    gradient: 'from-indigo-500 to-violet-500',
    amount: 4200,
    currency: '$',
    sub: '€1,850 · ₽25,000',
  },
  {
    icon: '🏦',
    name: 'Сбережения',
    gradient: 'from-emerald-500 to-emerald-400',
    amount: 8500,
    currency: '€',
    sub: 'Депозит 6%',
  },
  {
    icon: '💵',
    name: 'Наличные',
    gradient: 'from-amber-500 to-amber-400',
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
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #0c1222 0%, #111827 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-sky-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Мульти-валюта
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Все валюты — один счёт
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Храните USD, EUR, UZS и ещё 3 валюты на одном счёте
      </p>

      <div class="flex flex-wrap justify-center gap-3">
        <div
          v-for="(acc, i) in accounts"
          :key="i"
          class="w-40 rounded-xl border border-white/[0.08] bg-white/[0.06] p-3.5 text-left transition-all duration-500"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
          :style="{ transitionDelay: `${0.2 + i * 0.15}s` }"
        >
          <div class="mb-2 flex items-center gap-1.5">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-sm"
              :class="acc.gradient"
            >
              {{ acc.icon }}
            </div>
            <span class="text-xs font-semibold text-white">{{ acc.name }}</span>
          </div>
          <p class="text-base font-extrabold text-white">{{ displayAmounts[i].value }}</p>
          <p class="mt-0.5 text-[10px] text-white/50">{{ acc.sub }}</p>
        </div>
      </div>

      <div
        class="mx-auto mt-5 max-w-md rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.65s' }"
      >
        <p class="text-xs text-indigo-300">$1 = 12,850 сўм · €0.92 · ₽89.5</p>
        <p class="mt-0.5 text-[10px] text-white/30">Курсы обновляются автоматически</p>
      </div>
    </div>
  </section>
</template>
