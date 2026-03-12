<script setup lang="ts">
import { ReceiptFlow } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #1a0a0a 0%, #1c0f0f 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-red-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Сканирование
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Фото → Транзакция → Долги
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Сфотографируйте чек — мы распознаем сумму и создадим долги автоматически
      </p>

      <ReceiptFlow :is-visible="isVisible" />
    </div>
  </section>
</template>
