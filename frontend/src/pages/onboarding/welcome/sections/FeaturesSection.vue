<script setup lang="ts">
import { FeatureCard } from '../components';
import { useSectionAnimation } from '../composables';

const { sectionRef, isVisible } = useSectionAnimation();

const splitShares = [
  { name: 'Вы', color: 'border-indigo-500/15 bg-indigo-500/10 text-indigo-300', amount: '$25' },
  { name: 'Ахмед', color: 'border-amber-500/15 bg-amber-500/10 text-amber-300', amount: '$25' },
  {
    name: 'Анна',
    color: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-300',
    amount: '$25',
  },
];

const categories = [
  {
    emoji: '🛒',
    name: 'Продукты',
    color: 'border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-300/80',
  },
  {
    emoji: '🚗',
    name: 'Транспорт',
    color: 'border-indigo-500/15 bg-indigo-500/[0.07] text-indigo-300/80',
  },
  { emoji: '🎮', name: 'Игры', color: 'border-amber-500/15 bg-amber-500/[0.07] text-amber-300/80' },
  { emoji: '☕', name: 'Кофе', color: 'border-rose-500/15 bg-rose-500/[0.07] text-rose-300/80' },
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
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Возможности"
    style="background: linear-gradient(170deg, #140910 0%, #1a0a1e 40%, #150d18 100%)"
  >
    <!-- Ambient glow -->
    <div
      class="absolute left-[10%] top-[30%] h-[350px] w-[350px] rounded-full bg-fuchsia-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="absolute bottom-[25%] right-[10%] h-[250px] w-[250px] rounded-full bg-purple-500/[0.04] blur-[100px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-4xl">
      <!-- Header -->
      <div class="mb-12 text-center">
        <p
          class="mb-3 text-[10px] font-medium uppercase tracking-[4px] text-fuchsia-400/70 transition-all duration-600"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        >
          И ещё кое-что
        </p>
        <h2
          class="mb-3 text-3xl font-black text-white transition-all duration-600 sm:text-4xl"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.1s' }"
        >
          Мелочи, которые решают
        </h2>
      </div>

      <!-- Feature cards -->
      <div class="flex flex-wrap justify-center gap-4">
        <!-- Split expense -->
        <FeatureCard :is-visible="isVisible" :delay="0.2" class="w-44 text-left sm:w-52">
          <div
            class="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-lg"
          >
            👥
          </div>
          <p class="mb-1 text-sm font-bold text-white">Деление расходов</p>
          <p class="mb-3 text-[10px] leading-relaxed text-white/35">
            Ужин на 4? Разделите счёт — долги создадутся автоматически
          </p>
          <div class="flex gap-1.5">
            <div
              v-for="share in splitShares"
              :key="share.name"
              class="flex-1 rounded-lg border p-1.5 text-center"
              :class="share.color"
            >
              <p class="text-[8px] opacity-70">{{ share.name }}</p>
              <p class="text-[11px] font-bold">{{ share.amount }}</p>
            </div>
          </div>
        </FeatureCard>

        <!-- Custom categories -->
        <FeatureCard :is-visible="isVisible" :delay="0.35" class="w-44 text-left sm:w-52">
          <div
            class="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 text-lg"
          >
            🎨
          </div>
          <p class="mb-1 text-sm font-bold text-white">Свои категории</p>
          <p class="mb-3 text-[10px] leading-relaxed text-white/35">
            Настройте под себя — иконки, цвета, порядок
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(cat, i) in categories"
              :key="cat.name"
              class="rounded-lg border px-2 py-1 text-[9px] font-medium transition-all duration-400"
              :class="[cat.color, isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0']"
              :style="{ transitionDelay: `${0.5 + i * 0.08}s` }"
            >
              {{ cat.emoji }} {{ cat.name }}
            </span>
          </div>
        </FeatureCard>

        <!-- Quick actions -->
        <FeatureCard :is-visible="isVisible" :delay="0.5" class="w-44 text-left sm:w-52">
          <div
            class="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-lg"
          >
            ⚡
          </div>
          <p class="mb-1 text-sm font-bold text-white">Быстрые действия</p>
          <p class="mb-3 text-[10px] leading-relaxed text-white/35">
            Одно нажатие — расход записан
          </p>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(action, i) in quickActions"
              :key="action.name"
              class="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 transition-all duration-400"
              :class="isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'"
              :style="{ transitionDelay: `${0.6 + i * 0.08}s` }"
            >
              <span class="text-[10px] text-white/60">{{ action.emoji }} {{ action.name }}</span>
              <span class="text-[10px] font-bold tabular-nums text-white/80">
                {{ action.amount }}
              </span>
            </div>
          </div>
        </FeatureCard>
      </div>
    </div>
  </section>
</template>
