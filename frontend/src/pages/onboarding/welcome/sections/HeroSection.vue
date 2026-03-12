<script setup lang="ts">
import { BalanceCard, ScrollHint } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="relative flex min-h-dvh items-center justify-center px-6 py-12"
    style="background: linear-gradient(180deg, #0f0a2e 0%, #1a1145 100%)"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
      <div
        class="flex-1 text-center transition-all duration-700 lg:text-left"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <p class="mb-2 text-xs font-medium uppercase tracking-[3px] text-violet-400">
          Ouro Finance
        </p>
        <h1 class="mb-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          Ваши финансы.
          <br />
          Под контролем.
        </h1>
        <p
          class="mx-auto max-w-md text-sm text-white/50 transition-all duration-700 lg:mx-0 lg:text-base"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.2s' }"
        >
          Управляйте счетами, отслеживайте расходы, контролируйте долги — всё в одном приложении
        </p>
      </div>

      <div
        class="w-full max-w-xs transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
        :style="{ transitionDelay: '0.3s' }"
      >
        <BalanceCard :is-visible="isVisible" />
      </div>
    </div>

    <div class="absolute bottom-8 left-1/2 -translate-x-1/2">
      <ScrollHint />
    </div>
  </section>
</template>
