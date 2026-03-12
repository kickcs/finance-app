<script setup lang="ts">
import { ReceiptFlow } from '../components';
import { useSectionAnimation, SPRING_DEFAULT, SPRING_GENTLE } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Сканирование чеков"
  >
    <!-- Ambient glow -->
    <div
      class="pointer-events-none absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-rose-500/[0.05] blur-[150px]"
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
        <p class="mb-4 text-xs font-bold uppercase tracking-[6px] text-rose-500">
          Умное сканирование
        </p>
        <h2
          class="mb-5 text-4xl font-black text-white sm:text-5xl lg:text-6xl flex flex-wrap justify-center items-center gap-2 sm:gap-4"
        >
          <span class="text-white/90">Фото</span>
          <span class="text-rose-400/40 text-3xl font-light">→</span>
          <span class="text-white/90">Счёт</span>
          <span class="text-rose-400/40 text-3xl font-light">→</span>
          <span class="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
            Долги
          </span>
        </h2>
        <p class="text-white/50 text-sm max-w-md mx-auto">
          Сфотографируйте чек из ресторана или магазина. ИИ сам распознает позиции, посчитает сумму
          и поможет разделить её с друзьями.
        </p>
      </div>

      <div
        v-motion
        class="w-full max-w-4xl"
        :initial="{ opacity: 0, y: 40 }"
        :visible-once="{
          opacity: 1,
          y: 0,
          transition: { delay: 200, ...SPRING_GENTLE },
        }"
      >
        <ReceiptFlow :is-visible="isVisible" />
      </div>
    </div>
  </section>
</template>
