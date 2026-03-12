<script setup lang="ts">
import { DonutChart } from '../components';
import { useSectionAnimation, SPRING_DEFAULT, SPRING_GENTLE } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
const periods = ['Неделя', 'Месяц', 'Год'];
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Аналитика"
  >
    <!-- Ambient glow -->
    <div
      class="pointer-events-none absolute right-[5%] top-[30%] h-[500px] w-[500px] rounded-full bg-emerald-500/[0.05] blur-[150px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-5xl flex flex-col items-center">
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
        <p class="mb-4 text-xs font-bold uppercase tracking-[6px] text-emerald-400">Аналитика</p>
        <h2 class="mb-4 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
          Знайте, куда
          <br />
          <span class="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            уходят деньги
          </span>
        </h2>
        <p class="text-white/50 text-sm max-w-md mx-auto">
          Детальная разбивка по категориям, периодам и трендам. Все ваши расходы как на ладони.
        </p>
      </div>

      <!-- Chart -->
      <div
        v-motion
        class="glass-card gradient-border relative w-full max-w-2xl rounded-3xl p-8 sm:p-12 overflow-hidden group"
        :initial="{ opacity: 0, scale: 0.95, y: 30 }"
        :visible-once="{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { delay: 200, ...SPRING_GENTLE },
        }"
      >
        <!-- Internal Glow -->
        <div
          class="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        />

        <div class="relative z-10">
          <DonutChart :is-visible="isVisible" class="scale-110 sm:scale-125 mb-10 mt-6" />

          <!-- Period tabs -->
          <div
            v-motion
            class="mt-12 flex justify-center gap-2"
            :initial="{ opacity: 0, y: 15 }"
            :visible-once="{
              opacity: 1,
              y: 0,
              transition: { delay: 400, ...SPRING_DEFAULT },
            }"
          >
            <span
              v-for="(period, i) in periods"
              :key="period"
              class="rounded-xl px-5 py-2 text-xs font-bold transition-all cursor-default backdrop-blur-sm"
              :class="
                i === 0
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 border border-transparent'
              "
            >
              {{ period }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
