<script setup lang="ts">
import { DebtCard } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Долги"
    style="background: linear-gradient(170deg, #160e04 0%, #1c1108 40%, #1a1008 100%)"
  >
    <!-- Ambient glow -->
    <div
      class="absolute left-[15%] top-[25%] h-[350px] w-[350px] rounded-full bg-amber-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-[20%] right-[15%] h-[250px] w-[250px] rounded-full bg-red-500/[0.04] blur-[100px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-12 text-center">
        <p
          class="mb-3 text-[10px] font-medium uppercase tracking-[4px] text-amber-400/70 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        >
          Долги
        </p>
        <h2
          class="mb-3 text-3xl font-black text-white transition-all duration-600 sm:text-4xl"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.1s' }"
        >
          Никто не забыт
        </h2>
        <p
          class="text-sm text-white/35 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.15s' }"
        >
          Контролируйте кто кому должен с частичными платежами
        </p>
      </div>

      <!-- Debt cards -->
      <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        <div
          class="transition-all duration-700"
          :class="isVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'"
          :style="{ transitionDelay: '0.3s' }"
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
          class="hidden h-px w-12 sm:block"
          :class="isVisible ? 'opacity-100' : 'opacity-0'"
          :style="{ transitionDelay: '0.5s', transition: 'opacity 0.6s' }"
        >
          <div class="h-full bg-gradient-to-r from-amber-500/20 via-white/10 to-red-500/20" />
        </div>

        <div
          class="transition-all duration-700"
          :class="isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'"
          :style="{ transitionDelay: '0.3s' }"
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
