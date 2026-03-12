<script setup lang="ts">
import { ReceiptFlow } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Сканирование чеков"
    style="background: linear-gradient(170deg, #150808 0%, #1a0a0a 40%, #1c0f0f 100%)"
  >
    <!-- Ambient glow -->
    <div
      class="absolute right-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-rose-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-12 text-center">
        <p
          class="mb-3 text-[10px] font-medium uppercase tracking-[4px] text-rose-400/70 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        >
          Сканирование
        </p>
        <h2
          class="mb-3 text-3xl font-black text-white transition-all duration-600 sm:text-4xl"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.1s' }"
        >
          <span class="text-white/90">Фото</span>
          <span class="mx-2 text-rose-400/40">→</span>
          <span class="text-white/90">Транзакция</span>
          <span class="mx-2 text-rose-400/40">→</span>
          <span class="text-white/90">Долги</span>
        </h2>
        <p
          class="text-sm text-white/35 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.15s' }"
        >
          Сфотографируйте чек — мы распознаем сумму и создадим долги автоматически
        </p>
      </div>

      <ReceiptFlow :is-visible="isVisible" />
    </div>
  </section>
</template>
