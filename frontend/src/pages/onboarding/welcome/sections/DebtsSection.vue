<script setup lang="ts">
import { DebtCard } from '../components';
import { useSectionAnimation, SPRING_DEFAULT } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Долги"
  >
    <!-- Ambient glow -->
    <div
      class="pointer-events-none absolute left-[15%] top-[25%] h-[400px] w-[400px] rounded-full bg-amber-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute bottom-[20%] right-[15%] h-[300px] w-[300px] rounded-full bg-red-500/[0.04] blur-[100px]"
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
        <p class="mb-4 text-xs font-bold uppercase tracking-[6px] text-amber-500">Долги</p>
        <h2 class="mb-4 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
          <span class="bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">
            Никто не забыт
          </span>
        </h2>
        <p class="text-white/50 text-sm max-w-md mx-auto">
          Контролируйте, кто и сколько вам должен. Поддержка частичных платежей и автоматические
          напоминания.
        </p>
      </div>

      <!-- Debt cards -->
      <div class="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 w-full">
        <div
          v-motion
          :initial="{ opacity: 0, x: -40 }"
          :visible-once="{
            opacity: 1,
            x: 0,
            transition: { delay: 200, ...SPRING_DEFAULT },
          }"
          class="w-full max-w-sm"
        >
          <DebtCard
            name="Ахмед"
            type="given"
            amount="500,000 сўм"
            :progress="60"
            paid="300K"
            total="500K"
            :is-visible="isVisible"
          />
        </div>

        <!-- Connection line -->
        <div
          v-motion
          class="hidden h-px w-20 md:block relative"
          :initial="{ opacity: 0, scale: 0 }"
          :visible-once="{
            opacity: 1,
            scale: 1,
            transition: { delay: 400, type: 'spring', stiffness: 150, damping: 15 },
          }"
        >
          <div class="h-full bg-gradient-to-r from-amber-500/30 via-white/20 to-red-500/30" />
          <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.4)] blur-[1px]"
          />
        </div>

        <div
          v-motion
          :initial="{ opacity: 0, x: 40 }"
          :visible-once="{
            opacity: 1,
            x: 0,
            transition: { delay: 300, ...SPRING_DEFAULT },
          }"
          class="w-full max-w-sm"
        >
          <DebtCard
            name="Анна"
            type="received"
            amount="$200"
            :progress="25"
            paid="$50"
            total="$200"
            :is-visible="isVisible"
          />
        </div>
      </div>
    </div>
  </section>
</template>
