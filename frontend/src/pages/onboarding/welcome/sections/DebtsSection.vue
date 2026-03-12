<script setup lang="ts">
import { DebtCard } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #1c1108 0%, #1a1008 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-amber-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Долги
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Никто не забыт
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Контролируйте кто кому должен с частичными платежами
      </p>

      <div class="flex flex-wrap justify-center gap-3">
        <div
          class="transition-all duration-600"
          :class="isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'"
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
        <div
          class="transition-all duration-600"
          :class="isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'"
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
