<script setup lang="ts">
import { DonutChart } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
const periods = ['Неделя', 'Месяц', 'Год'];
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #052e16 0%, #0a1f12 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-emerald-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Аналитика
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Знайте, куда уходят деньги
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Детальная разбивка по категориям, периодам и трендам
      </p>

      <DonutChart :is-visible="isVisible" />

      <div
        class="mt-5 flex justify-center gap-1 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.8s' }"
      >
        <span
          v-for="(period, i) in periods"
          :key="period"
          class="rounded-md px-3.5 py-1.5 text-xs"
          :class="i === 0 ? 'bg-emerald-500/15 font-semibold text-emerald-400' : 'text-white/30'"
        >
          {{ period }}
        </span>
      </div>
    </div>
  </section>
</template>
