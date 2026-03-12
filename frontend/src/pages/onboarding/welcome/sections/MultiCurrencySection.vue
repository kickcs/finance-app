<script setup lang="ts">
import { ref } from 'vue';
import { useSectionAnimation, useCountUp, SPRING_DEFAULT, SPRING_GENTLE } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();

const accounts = [
  {
    icon: '💳',
    name: 'Visa Gold',
    accent: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/30',
    amount: 4200,
    currency: '$',
    sub: '€1,850 · ₽25,000',
  },
  {
    icon: '🏦',
    name: 'Сбережения',
    accent: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    amount: 8500,
    currency: '€',
    sub: 'Депозит 6%',
  },
  {
    icon: '💵',
    name: 'Наличные',
    accent: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
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
  >
    <!-- Section separating overlay -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505] to-transparent"
    />
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050505] to-transparent"
    />

    <!-- Ambient glow -->
    <div
      class="pointer-events-none absolute left-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-cyan-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-5xl">
      <!-- Header -->
      <div
        v-motion
        class="mb-16 text-center"
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{
          opacity: 1,
          y: 0,
          transition: SPRING_DEFAULT,
        }"
      >
        <p class="mb-4 text-xs font-bold uppercase tracking-[6px] text-cyan-400">Мульти-валюта</p>
        <h2
          class="mb-4 text-4xl font-black text-white sm:text-5xl lg:text-6xl filter drop-shadow-md"
        >
          Все валюты —
          <br />
          <span class="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            один счёт
          </span>
        </h2>
        <p class="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
          Храните USD, EUR, UZS и ещё 3 валюты на одном счёте. Управляйте капиталом без границ.
        </p>
      </div>

      <!-- Account cards -->
      <div class="flex flex-wrap justify-center gap-6">
        <div
          v-for="(acc, i) in accounts"
          :key="i"
          v-motion
          class="glass-card gradient-border relative w-56 rounded-3xl p-6 text-left transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-cyan-900/20 group bg-white/[0.01]"
          :initial="{ opacity: 0, y: 40 }"
          :visible-once="{
            opacity: 1,
            y: 0,
            transition: { delay: i * 150, ...SPRING_GENTLE },
          }"
        >
          <!-- Internal Glow -->
          <div
            class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-cyan-500/5 to-transparent rounded-b-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          />

          <div class="mb-6 flex items-center gap-3 relative z-10">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-2xl ring-1 shadow-inner text-lg"
              :class="acc.accent"
            >
              {{ acc.icon }}
            </div>
            <span class="text-sm font-semibold text-white/90">{{ acc.name }}</span>
          </div>
          <p
            class="font-['Unbounded'] text-2xl font-bold text-white mb-2 relative z-10 filter drop-shadow-sm"
          >
            {{ displayAmounts[i].value }}
          </p>
          <p class="text-xs text-white/40 relative z-10">{{ acc.sub }}</p>
        </div>
      </div>

      <!-- Exchange rate bar -->
      <div
        v-motion
        class="mx-auto mt-12 max-w-md"
        :initial="{ opacity: 0, scale: 0.95 }"
        :visible-once="{
          opacity: 1,
          scale: 1,
          transition: { delay: 400, ...SPRING_DEFAULT },
        }"
      >
        <div
          class="glass-card rounded-2xl px-6 py-4 text-center border border-white/5 bg-white/[0.02]"
        >
          <p class="text-sm font-medium text-cyan-100/70 mb-1">$1 = 12,850 сўм · €0.92 · ₽89.5</p>
          <p
            class="text-[10px] text-white/30 uppercase tracking-widest font-semibold tracking-[2px]"
          >
            Курсы обновляются автоматически
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
