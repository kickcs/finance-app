<script setup lang="ts">
import { ref, computed } from 'vue';
import { BalanceCard, ScrollHint } from '../components';
import { useSectionAnimation, SPRING_DEFAULT, SPRING_GENTLE } from '../composables';
import { useMouseInElement } from '@vueuse/core';

const { sectionRef, isVisible } = useSectionAnimation();

// 3D tilt effect on the card
const cardContainerRef = ref(null);
const { elementX, elementY, isOutside, elementHeight, elementWidth } = useMouseInElement(
  cardContainerRef,
  { windowScroll: false },
);

const cardTransform = computed(() => {
  if (isOutside.value || elementHeight.value === 0 || elementWidth.value === 0) {
    return 'perspective(1200px) rotateX(2deg) rotateY(-4deg)';
  }

  const MAX_ROTATION = 12;
  const x = (elementX.value / elementWidth.value - 0.5) * 2;
  const y = (elementY.value / elementHeight.value - 0.5) * 2;

  return `perspective(1200px) rotateX(${-y * MAX_ROTATION}deg) rotateY(${x * MAX_ROTATION}deg) scale3d(1.02, 1.02, 1.02)`;
});
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Главная"
  >
    <!-- Ambient glow orbs -->
    <div
      class="pointer-events-none absolute right-[5%] top-[10%] h-[600px] w-[600px] rounded-full bg-indigo-600/[0.08] blur-[150px]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute bottom-[5%] left-[5%] h-[500px] w-[500px] rounded-full bg-purple-600/[0.06] blur-[150px]"
      aria-hidden="true"
    />

    <div
      class="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-center lg:justify-between lg:gap-20"
    >
      <!-- Text block -->
      <div
        v-motion
        class="flex-1 text-center lg:text-left pt-10 lg:pt-0"
        :initial="{ opacity: 0, x: -30 }"
        :enter="{ opacity: 1, x: 0, transition: SPRING_GENTLE }"
      >
        <div
          class="mb-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.02] px-5 py-2 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.1)]"
        >
          <div
            class="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] animate-pulse"
          />
          <span class="text-xs font-bold uppercase tracking-[4px] text-white/60">
            Встречайте Ouro
          </span>
        </div>

        <h1
          class="mb-6 text-5xl font-black leading-[1.05] sm:text-6xl xl:text-7xl filter drop-shadow-lg"
        >
          <span
            class="bg-gradient-to-br from-white via-indigo-50 to-indigo-200 bg-clip-text text-transparent block mb-1"
          >
            Ваши финансы.
          </span>
          <span
            class="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent inline-block filter drop-shadow-[0_0_25px_rgba(139,92,246,0.25)]"
          >
            Под контролем.
          </span>
        </h1>

        <p
          v-motion
          class="mx-auto max-w-lg text-base leading-relaxed text-white/50 lg:mx-0 lg:text-lg"
          :initial="{ opacity: 0, y: 30 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: { delay: 200, ...SPRING_DEFAULT },
          }"
        >
          Управляйте счетами, отслеживайте расходы, делите чеки и контролируйте долги — всё в одном
          премиальном приложении.
        </p>
      </div>

      <!-- Balance card with interactive perspective -->
      <div
        ref="cardContainerRef"
        v-motion
        class="w-full max-w-sm lg:max-w-md xl:max-w-lg lg:shrink-0"
        :initial="{ opacity: 0, scale: 0.9, x: 30 }"
        :enter="{
          opacity: 1,
          scale: 1,
          x: 0,
          transition: { delay: 300, type: 'spring', stiffness: 150, damping: 22 },
        }"
      >
        <div class="relative w-full">
          <!-- Card huge glow -->
          <div
            class="absolute inset-[-40%] rounded-full bg-indigo-500/[0.08] blur-[80px] -z-10 pointer-events-none"
            aria-hidden="true"
          />
          <div
            class="card-tilt relative transition-transform duration-300 ease-out will-change-transform drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            :style="{ transform: cardTransform }"
          >
            <!-- 3D depth layer -->
            <div
              class="absolute inset-x-4 -bottom-4 h-full bg-indigo-900/20 blur-xl rounded-3xl pointer-events-none"
            />

            <BalanceCard :is-visible="isVisible" class="relative z-10" />
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll hint -->
    <div class="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
      <ScrollHint />
    </div>
  </section>
</template>

<style scoped>
/* Extra smooth 3D transform */
.card-tilt {
  transform-style: preserve-3d;
}
</style>
