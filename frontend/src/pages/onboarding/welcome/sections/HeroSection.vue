<script setup lang="ts">
import { BalanceCard, ScrollHint } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16"
    aria-label="Главная"
    style="background: linear-gradient(170deg, #0c0820 0%, #150f35 40%, #0f0a2e 100%)"
  >
    <!-- Ambient glow orbs -->
    <div
      class="absolute right-[-10%] top-[15%] h-[500px] w-[500px] rounded-full bg-indigo-600/[0.08] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-[10%] left-[-5%] h-[300px] w-[300px] rounded-full bg-violet-500/[0.06] blur-[100px]"
      aria-hidden="true"
    />

    <div
      class="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-20"
    >
      <!-- Text block -->
      <div
        class="flex-1 text-center transition-all duration-800 lg:text-left"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
      >
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm"
        >
          <div
            class="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
          />
          <span class="text-[10px] font-medium uppercase tracking-[3px] text-white/50">
            Ouro Finance
          </span>
        </div>

        <h1 class="mb-4 text-4xl font-black leading-[1.05] sm:text-5xl lg:text-6xl">
          <span
            class="bg-gradient-to-r from-white via-white to-indigo-200 bg-clip-text text-transparent"
          >
            Ваши финансы.
          </span>
          <br />
          <span
            class="bg-gradient-to-r from-indigo-300 via-violet-300 to-purple-300 bg-clip-text text-transparent"
          >
            Под контролем.
          </span>
        </h1>

        <p
          class="mx-auto max-w-md text-sm leading-relaxed text-white/40 transition-all duration-800 lg:mx-0 lg:text-base"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.25s' }"
        >
          Управляйте счетами, отслеживайте расходы, контролируйте долги — всё в одном приложении
        </p>
      </div>

      <!-- Balance card with perspective -->
      <div
        class="w-full max-w-xs transition-all duration-900"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'"
        :style="{ transitionDelay: '0.35s' }"
      >
        <div class="relative">
          <!-- Card glow -->
          <div
            class="absolute inset-[-30%] rounded-full bg-indigo-500/[0.08] blur-[60px]"
            aria-hidden="true"
          />
          <div class="card-tilt relative">
            <BalanceCard :is-visible="isVisible" />
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll hint -->
    <div class="absolute bottom-10 left-1/2 z-10 -translate-x-1/2">
      <ScrollHint />
    </div>
  </section>
</template>

<style scoped>
.card-tilt {
  transform: perspective(800px) rotateY(-2deg) rotateX(1deg);
}

@media (max-width: 1023px) {
  .card-tilt {
    transform: none;
  }
}
</style>
