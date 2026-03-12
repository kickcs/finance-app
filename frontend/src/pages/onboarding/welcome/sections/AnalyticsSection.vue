<script setup lang="ts">
import { DonutChart } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
const periods = ['Неделя', 'Месяц', 'Год'];
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Аналитика"
    style="background: linear-gradient(170deg, #031a0e 0%, #052e16 40%, #0a1f12 100%)"
  >
    <!-- Ambient glow -->
    <div
      class="absolute right-[5%] top-[30%] h-[400px] w-[400px] rounded-full bg-emerald-500/[0.06] blur-[120px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-12 text-center">
        <p
          class="mb-3 text-[10px] font-medium uppercase tracking-[4px] text-emerald-400/70 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        >
          Аналитика
        </p>
        <h2
          class="mb-3 text-3xl font-black text-white transition-all duration-600 sm:text-4xl"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.1s' }"
        >
          Знайте, куда уходят деньги
        </h2>
        <p
          class="text-sm text-white/35 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.15s' }"
        >
          Детальная разбивка по категориям, периодам и трендам
        </p>
      </div>

      <!-- Chart -->
      <div class="glass-card gradient-border mx-auto max-w-lg rounded-2xl p-6 sm:p-8">
        <DonutChart :is-visible="isVisible" />

        <!-- Period tabs -->
        <div
          class="mt-6 flex justify-center gap-1 transition-all duration-500"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.8s' }"
        >
          <span
            v-for="(period, i) in periods"
            :key="period"
            class="rounded-lg px-4 py-1.5 text-[11px] font-medium transition-colors"
            :class="
              i === 0
                ? 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.1)]'
                : 'text-white/25 hover:text-white/40'
            "
          >
            {{ period }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
