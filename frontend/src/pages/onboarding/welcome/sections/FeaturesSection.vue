<script setup lang="ts">
import { SPRING_DEFAULT, SPRING_GENTLE, SPRING_BOUNCY } from '../composables';

const splitShares = [
  { name: 'Вы', color: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300', amount: '$25' },
  { name: 'Ахмед', color: 'border-amber-500/20 bg-amber-500/10 text-amber-300', amount: '$25' },
  {
    name: 'Анна',
    color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amount: '$25',
  },
];

const categories = [
  {
    emoji: '🛒',
    name: 'Продукты',
    color: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300',
  },
  {
    emoji: '🚗',
    name: 'Транспорт',
    color: 'border-indigo-500/20 bg-indigo-500/[0.07] text-indigo-300',
  },
  { emoji: '🎮', name: 'Игры', color: 'border-amber-500/20 bg-amber-500/[0.07] text-amber-300' },
  { emoji: '☕', name: 'Кофе', color: 'border-rose-500/20 bg-rose-500/[0.07] text-rose-300' },
  {
    emoji: '✈️',
    name: 'Путешествия',
    color: 'border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-300',
  },
];

const quickActions = [
  { emoji: '🚇', name: 'Метро', amount: '−46₽' },
  { emoji: '☕', name: 'Кофе', amount: '−250₽' },
  { emoji: '🥗', name: 'Обед', amount: '−350₽' },
];
</script>

<template>
  <section
    class="welcome-section relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-20"
    aria-label="Возможности"
  >
    <!-- Ambient glow -->
    <div
      class="pointer-events-none absolute left-[10%] top-[30%] h-[350px] w-[350px] rounded-full bg-fuchsia-500/[0.05] blur-[120px]"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute bottom-[25%] right-[10%] h-[400px] w-[400px] rounded-full bg-purple-600/[0.04] blur-[100px]"
      aria-hidden="true"
    />

    <div class="relative z-10 mx-auto w-full max-w-5xl">
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
        <p class="mb-4 text-xs font-bold uppercase tracking-[6px] text-fuchsia-400">
          Больше возможностей
        </p>
        <h2 class="mb-4 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
          Спроектировано для
          <br />
          <span
            class="bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent"
          >
            максимального удобства
          </span>
        </h2>
      </div>

      <!-- Bento Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 gap-4 lg:gap-6">
        <!-- Bento Item 1: Split Expense (Large Left) -->
        <div
          v-motion
          class="glass-card gradient-border relative md:col-span-7 bg-white/[0.02] p-8 rounded-3xl flex flex-col justify-between overflow-hidden group"
          :initial="{ opacity: 0, x: -30 }"
          :visible-once="{ opacity: 1, x: 0, transition: { delay: 100, ...SPRING_GENTLE } }"
        >
          <div
            class="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 blur-[50px] rounded-full group-hover:bg-indigo-500/30 transition-colors duration-700"
          />
          <div class="mb-6 z-10">
            <div
              class="mb-4 w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/10"
            >
              👥
            </div>
            <h3 class="text-2xl font-bold text-white mb-2 font-[Unbounded]">Деление расходов</h3>
            <p class="text-white/50 text-sm max-w-xs leading-relaxed">
              Ужин с друзьями? Разделите счёт в пару кликов, мы автоматически создадим долги и
              напомним о них.
            </p>
          </div>

          <div
            class="flex gap-2.5 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm z-10 w-full"
          >
            <div
              v-for="share in splitShares"
              :key="share.name"
              class="flex-1 rounded-xl border p-2 text-center flex flex-col items-center justify-center transition-colors"
              :class="share.color"
            >
              <p class="text-[10px] opacity-70 mb-1 font-medium">{{ share.name }}</p>
              <p class="text-sm font-bold">{{ share.amount }}</p>
            </div>
          </div>
        </div>

        <!-- Bento Item 2: Quick Actions (Top Right) -->
        <div
          v-motion
          class="glass-card gradient-border relative md:col-span-5 bg-white/[0.02] p-8 rounded-3xl flex flex-col justify-between overflow-hidden group"
          :initial="{ opacity: 0, y: -30 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 200, ...SPRING_GENTLE } }"
        >
          <div
            class="absolute -right-5 -bottom-5 w-32 h-32 bg-amber-500/15 blur-[40px] rounded-full group-hover:bg-amber-500/25 transition-colors duration-700"
          />
          <div class="mb-5 z-10">
            <div
              class="mb-4 w-10 h-10 flex items-center justify-center rounded-2xl bg-amber-500/10 text-xl ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10"
            >
              ⚡
            </div>
            <h3 class="text-lg font-bold text-white mb-1 font-[Unbounded]">Быстрые действия</h3>
            <p class="text-white/50 text-xs">Добавляйте частые расходы в один свайп.</p>
          </div>

          <div class="flex flex-col gap-2 relative z-10">
            <div
              v-for="(action, i) in quickActions"
              :key="action.name"
              v-motion
              class="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default"
              :initial="{ opacity: 0, x: 20 }"
              :visible-once="{
                opacity: 1,
                x: 0,
                transition: { delay: 400 + i * 100, ...SPRING_DEFAULT },
              }"
            >
              <span class="text-xs text-white/80 font-medium">
                {{ action.emoji }} {{ action.name }}
              </span>
              <span class="text-xs font-bold tabular-nums text-white">
                {{ action.amount }}
              </span>
            </div>
          </div>
        </div>

        <!-- Bento Item 3: Tags / Categories (Bottom Spanning) -->
        <div
          v-motion
          class="glass-card gradient-border relative md:col-span-12 bg-white/[0.02] p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between overflow-hidden group gap-8"
          :initial="{ opacity: 0, y: 30 }"
          :visible-once="{ opacity: 1, y: 0, transition: { delay: 300, ...SPRING_GENTLE } }"
        >
          <div
            class="absolute left-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-fuchsia-500/10 blur-[60px] rounded-full group-hover:bg-fuchsia-500/20 transition-colors duration-700 pointer-events-none"
          />

          <div class="md:max-w-sm relative z-10 text-center md:text-left flex-shrink-0">
            <div
              class="mb-4 w-12 h-12 mx-auto md:mx-0 flex items-center justify-center rounded-2xl bg-fuchsia-500/10 text-2xl ring-1 ring-fuchsia-500/20 shadow-lg shadow-fuchsia-500/10"
            >
              🎨
            </div>
            <h3 class="text-xl font-bold text-white mb-3 font-[Unbounded]">Свобода кастомизации</h3>
            <p class="text-white/50 text-sm leading-relaxed">
              Создавайте любые категории, выбирайте иконки и цвета. Забудьте о стандартных списках.
            </p>
          </div>

          <div class="flex flex-wrap gap-3 justify-center md:justify-end flex-1 relative z-10">
            <span
              v-for="(cat, i) in categories"
              :key="cat.name"
              v-motion
              class="rounded-xl border px-4 py-2 text-xs font-medium backdrop-blur-sm hover:-translate-y-1 hover:shadow-lg transition-all cursor-default flex items-center gap-1.5"
              :initial="{ opacity: 0, scale: 0.8 }"
              :visible-once="{
                opacity: 1,
                scale: 1,
                transition: { delay: 500 + i * 50, ...SPRING_BOUNCY },
              }"
              :class="[cat.color]"
            >
              <span>{{ cat.emoji }}</span>
              <span>{{ cat.name }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
