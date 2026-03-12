<script setup lang="ts">
import { FeatureCard } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();

const splitShares = [
  { name: 'Вы', color: 'bg-indigo-500/20 text-indigo-300', amount: '$25' },
  { name: 'Ахмед', color: 'bg-amber-500/20 text-amber-300', amount: '$25' },
  { name: 'Анна', color: 'bg-emerald-500/20 text-emerald-300', amount: '$25' },
];

const categories = [
  { emoji: '🛒', name: 'Продукты', color: 'bg-emerald-500/20 text-emerald-300' },
  { emoji: '🚗', name: 'Транспорт', color: 'bg-indigo-500/20 text-indigo-300' },
  { emoji: '🎮', name: 'Игры', color: 'bg-amber-500/20 text-amber-300' },
  { emoji: '☕', name: 'Кофе', color: 'bg-red-500/20 text-red-300' },
];

const quickActions = [
  { emoji: '🚇', name: 'Метро', amount: '−46₽' },
  { emoji: '☕', name: 'Кофе', amount: '−250₽' },
  { emoji: '🥗', name: 'Обед', amount: '−350₽' },
];
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #1a0a1e 0%, #150d18 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-fuchsia-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        И ещё кое-что
      </p>
      <h2
        class="mb-8 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Мелочи, которые решают
      </h2>

      <div class="flex flex-wrap justify-center gap-3">
        <FeatureCard :is-visible="isVisible" :delay="0.2" class="w-40 text-left sm:w-44">
          <p class="mb-2 text-2xl">👥</p>
          <p class="mb-1 text-sm font-bold text-white">Деление расходов</p>
          <p class="mb-3 text-[10px] text-white/50">
            Ужин на 4? Разделите счёт — долги создадутся автоматически
          </p>
          <div class="flex gap-1">
            <div
              v-for="share in splitShares"
              :key="share.name"
              class="flex-1 rounded-md p-1 text-center"
              :class="share.color"
            >
              <p class="text-[8px]">{{ share.name }}</p>
              <p class="text-[11px] font-semibold">{{ share.amount }}</p>
            </div>
          </div>
        </FeatureCard>

        <FeatureCard :is-visible="isVisible" :delay="0.35" class="w-40 text-left sm:w-44">
          <p class="mb-2 text-2xl">🎨</p>
          <p class="mb-1 text-sm font-bold text-white">Свои категории</p>
          <p class="mb-3 text-[10px] text-white/50">Настройте под себя — иконки, цвета, порядок</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="(cat, i) in categories"
              :key="cat.name"
              class="rounded-xl px-2 py-0.5 text-[9px] transition-all duration-300"
              :class="[cat.color, isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0']"
              :style="{ transitionDelay: `${0.5 + i * 0.1}s` }"
            >
              {{ cat.emoji }} {{ cat.name }}
            </span>
          </div>
        </FeatureCard>

        <FeatureCard :is-visible="isVisible" :delay="0.5" class="w-40 text-left sm:w-44">
          <p class="mb-2 text-2xl">⚡</p>
          <p class="mb-1 text-sm font-bold text-white">Быстрые действия</p>
          <p class="mb-3 text-[10px] text-white/50">Одно нажатие — расход записан</p>
          <div class="flex flex-col gap-1">
            <div
              v-for="(action, i) in quickActions"
              :key="action.name"
              class="flex items-center justify-between rounded-md bg-white/[0.08] px-2 py-1.5 transition-all duration-400"
              :class="isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'"
              :style="{ transitionDelay: `${0.6 + i * 0.1}s` }"
            >
              <span class="text-[10px] text-white">{{ action.emoji }} {{ action.name }}</span>
              <span class="text-[10px] font-semibold text-white">{{ action.amount }}</span>
            </div>
          </div>
        </FeatureCard>
      </div>
    </div>
  </section>
</template>
