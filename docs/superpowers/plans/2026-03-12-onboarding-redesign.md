# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile-only swipe carousel onboarding with a cinematic scroll-animated landing page (7 sections) that works on both web and mobile.

**Architecture:** Single-page landing with full-viewport sections, each revealing content via Intersection Observer scroll-triggered CSS transitions. Two composables (useScrollAnimations, useCountUp) power all animations. Forced dark theme on the landing page.

**Tech Stack:** Vue 3 (Composition API), Tailwind CSS v4, Intersection Observer API, requestAnimationFrame, SVG (donut chart)

**Spec:** `docs/superpowers/specs/2026-03-12-onboarding-redesign-design.md`

---

## Chunk 1: Foundation — Composables & Shared Components

### Task 1: useCountUp composable

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/composables/useCountUp.ts`

- [ ] **Step 1: Create useCountUp.ts**

```typescript
import { ref, watch, onUnmounted, type Ref } from 'vue'

function easeOutQuad(t: number): number {
  return t * (2 - t)
}

export function useCountUp(
  target: Ref<number>,
  isVisible: Ref<boolean>,
  options: {
    duration?: number
    format?: (n: number) => string
  } = {},
) {
  const { duration = 1500, format = (n) => n.toLocaleString('ru-RU') } = options
  const display = ref(format(0))
  let animationId: number | null = null

  function animate() {
    if (animationId) cancelAnimationFrame(animationId)

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      display.value = format(target.value)
      return
    }

    const startTime = performance.now()
    const startValue = 0
    const endValue = target.value

    function step(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutQuad(progress)
      const currentValue = startValue + (endValue - startValue) * easedProgress

      display.value = format(currentValue)

      if (progress < 1) {
        animationId = requestAnimationFrame(step)
      } else {
        animationId = null
      }
    }

    animationId = requestAnimationFrame(step)
  }

  watch(isVisible, (visible) => {
    if (visible) animate()
  })

  onUnmounted(() => {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  })

  return display
}
```

- [ ] **Step 2: Verify file created**

Run: `ls frontend/src/pages/onboarding/welcome/composables/useCountUp.ts`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/composables/useCountUp.ts
git commit -m "feat(onboarding): add useCountUp composable for animated number counting"
```

---

### Task 2: useScrollAnimations composable

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/composables/useScrollAnimations.ts`

- [ ] **Step 1: Create useScrollAnimations.ts**

```typescript
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export function useScrollAnimation(
  elementRef: Ref<HTMLElement | null>,
  options: { threshold?: number } = {},
) {
  const { threshold = 0.2 } = options
  const isVisible = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!elementRef.value) return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true
            observer?.unobserve(entry.target)
          }
        })
      },
      { threshold },
    )

    observer.observe(elementRef.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { isVisible }
}

export function useSectionAnimation() {
  const sectionRef = ref<HTMLElement | null>(null)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // If user prefers reduced motion, elements are visible immediately
  const { isVisible } = useScrollAnimation(sectionRef)
  const effectiveVisible = prefersReducedMotion ? ref(true) : isVisible
  return { sectionRef, isVisible: effectiveVisible }
}
```

- [ ] **Step 2: Create composables index**

Create `frontend/src/pages/onboarding/welcome/composables/index.ts`:

```typescript
export { useCountUp } from './useCountUp'
export { useScrollAnimation, useSectionAnimation } from './useScrollAnimations'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/composables/
git commit -m "feat(onboarding): add scroll animation composables (Intersection Observer)"
```

---

### Task 3: ScrollHint component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/ScrollHint.vue`

- [ ] **Step 1: Create ScrollHint.vue**

```vue
<script setup lang="ts">
</script>

<template>
  <div class="flex flex-col items-center gap-1 animate-bounce">
    <span class="text-xs text-white/40">Узнать больше</span>
    <svg
      class="h-5 w-5 text-white/40"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/ScrollHint.vue
git commit -m "feat(onboarding): add ScrollHint component"
```

---

### Task 4: BalanceCard component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/BalanceCard.vue`

- [ ] **Step 1: Create BalanceCard.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCountUp } from '../composables'

const props = defineProps<{
  isVisible: boolean
}>()

const visibleRef = computed(() => props.isVisible)
const balanceTarget = ref(12450)
const incomeTarget = ref(3200)
const expenseTarget = ref(1850)

const balance = useCountUp(balanceTarget, visibleRef, {
  format: (n) => `$${Math.floor(n).toLocaleString('en-US')}`,
})
const balanceCents = '.00'

const income = useCountUp(incomeTarget, visibleRef, {
  format: (n) => `+$${Math.floor(n).toLocaleString('en-US')}`,
  duration: 1200,
})

const expense = useCountUp(expenseTarget, visibleRef, {
  format: (n) => `-$${Math.floor(n).toLocaleString('en-US')}`,
  duration: 1200,
})
</script>

<template>
  <div
    class="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md"
  >
    <p class="mb-1 text-xs text-white/50">Общий баланс</p>
    <p class="mb-4 text-3xl font-extrabold text-white">
      {{ balance }}<span class="text-lg text-indigo-400">{{ balanceCents }}</span>
    </p>
    <div
      class="flex gap-2 transition-all duration-500"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      :style="{ transitionDelay: '0.3s' }"
    >
      <div class="flex-1 rounded-lg bg-emerald-500/15 p-2">
        <p class="text-[10px] text-emerald-300">↑ Доход</p>
        <p class="text-sm font-bold text-emerald-500">{{ income }}</p>
      </div>
      <div class="flex-1 rounded-lg bg-red-500/15 p-2">
        <p class="text-[10px] text-red-300">↓ Расход</p>
        <p class="text-sm font-bold text-red-500">{{ expense }}</p>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/BalanceCard.vue
git commit -m "feat(onboarding): add animated BalanceCard component"
```

---

### Task 5: DonutChart component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/DonutChart.vue`

- [ ] **Step 1: Create DonutChart.vue**

The donut uses SVG circles with `stroke-dasharray` transitions triggered by isVisible.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCountUp } from '../composables'

const props = defineProps<{
  isVisible: boolean
}>()

const visibleRef = computed(() => props.isVisible)
const totalTarget = ref(1850)
const total = useCountUp(totalTarget, visibleRef, {
  format: (n) => `$${Math.floor(n).toLocaleString('en-US')}`,
})

const segments = [
  { color: '#10b981', percent: 35, label: 'Продукты', dasharray: '110 204' },
  { color: '#6366f1', percent: 20, label: 'Транспорт', dasharray: '62 252' },
  { color: '#f59e0b', percent: 15, label: 'Развлечения', dasharray: '45 269' },
  { color: '#ef4444', percent: 10, label: 'Рестораны', dasharray: '30 284' },
  { color: 'rgba(255,255,255,0.15)', percent: 20, label: 'Другое', dasharray: '63 251' },
]

// Calculate cumulative offsets for each segment
const segmentOffsets = computed(() => {
  let offset = 0
  return segments.map((s) => {
    const current = offset
    offset += parseFloat(s.dasharray.split(' ')[0])
    return -current
  })
})
</script>

<template>
  <div class="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
    <!-- Donut -->
    <div class="relative h-36 w-36">
      <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
        <circle
          cx="60" cy="60" r="50" fill="none"
          stroke="rgba(255,255,255,0.05)" stroke-width="16"
        />
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          cx="60" cy="60" r="50" fill="none"
          :stroke="seg.color"
          stroke-width="16"
          stroke-linecap="round"
          class="transition-all duration-1000 ease-out"
          :style="{
            strokeDasharray: isVisible ? seg.dasharray : '0 314',
            strokeDashoffset: isVisible ? segmentOffsets[i] : 0,
            transitionDelay: `${i * 0.15}s`,
          }"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <p class="text-base font-extrabold text-white">{{ total }}</p>
        <p class="text-[10px] text-white/50">расходы</p>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-col gap-2">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="flex items-center gap-2 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'"
        :style="{ transitionDelay: `${0.3 + i * 0.1}s` }"
      >
        <span
          class="h-2.5 w-2.5 rounded-sm"
          :style="{ backgroundColor: seg.color }"
        />
        <span class="text-xs text-white">{{ seg.label }}</span>
        <span class="ml-auto text-xs text-white/50">{{ seg.percent }}%</span>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/DonutChart.vue
git commit -m "feat(onboarding): add animated DonutChart SVG component"
```

---

### Task 6: DebtCard component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/DebtCard.vue`

- [ ] **Step 1: Create DebtCard.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCountUp } from '../composables'

const props = defineProps<{
  name: string
  type: 'given' | 'received'
  amount: string
  progress: number
  paid: string
  total: string
  isVisible: boolean
}>()

const visibleRef = computed(() => props.isVisible)
const progressTarget = ref(props.progress)
const progressDisplay = useCountUp(progressTarget, visibleRef, {
  duration: 1000,
  format: (n) => `${Math.round(n)}%`,
})

const colorMap = {
  given: {
    gradient: 'from-amber-500 to-amber-600',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    label: 'Дал в долг',
  },
  received: {
    gradient: 'from-red-500 to-red-600',
    border: 'border-red-500/20',
    text: 'text-red-400',
    bar: 'bg-gradient-to-r from-red-500 to-red-400',
    label: 'Взял в долг',
  },
}

const colors = computed(() => colorMap[props.type])
</script>

<template>
  <div
    class="w-44 rounded-xl border bg-white/[0.06] p-4"
    :class="colors.border"
  >
    <div class="mb-2.5 flex items-center gap-1.5">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white"
        :class="colors.gradient"
      >
        {{ name[0] }}
      </div>
      <div>
        <p class="text-xs font-semibold text-white">{{ name }}</p>
        <p class="text-[10px]" :class="colors.text">{{ colors.label }}</p>
      </div>
    </div>
    <p class="mb-2 text-lg font-extrabold text-white">{{ amount }}</p>
    <!-- Progress bar -->
    <div class="mb-1 h-1.5 rounded-full bg-white/10">
      <div
        class="h-1.5 rounded-full transition-all duration-1000 ease-out"
        :class="colors.bar"
        :style="{ width: isVisible ? `${progress}%` : '0%' }"
      />
    </div>
    <div class="flex justify-between">
      <span class="text-[10px] text-white/50">Возвращено {{ progressDisplay }}</span>
      <span class="text-[10px]" :class="colors.text">{{ paid }} / {{ total }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/DebtCard.vue
git commit -m "feat(onboarding): add animated DebtCard component"
```

---

### Task 7: ReceiptFlow component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/ReceiptFlow.vue`

- [ ] **Step 1: Create ReceiptFlow.vue**

Three-step visual: photo → AI processing → result with auto-created debts.

```vue
<script setup lang="ts">
defineProps<{
  isVisible: boolean
}>()

const steps = [
  {
    icon: '📸',
    label: 'Фото чека',
    type: 'receipt' as const,
  },
  {
    icon: '🤖',
    label: 'Распознаём',
    type: 'processing' as const,
  },
  {
    icon: '✅',
    label: 'Готово!',
    type: 'result' as const,
  },
]
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
    <template v-for="(step, i) in steps" :key="i">
      <!-- Step card -->
      <div
        class="w-28 rounded-xl border border-white/[0.08] p-3 text-center transition-all duration-500 sm:w-32 sm:p-4"
        :class="[
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          step.type === 'processing' ? 'border-red-500/20 bg-red-500/10' : 'bg-white/[0.06]',
          step.type === 'result' ? 'border-emerald-500/20' : '',
        ]"
        :style="{ transitionDelay: `${i * 0.3}s` }"
      >
        <p class="mb-1.5 text-2xl">{{ step.icon }}</p>
        <p
          class="text-[10px]"
          :class="{
            'text-white/50': step.type === 'receipt',
            'text-red-400': step.type === 'processing',
            'text-emerald-400': step.type === 'result',
          }"
        >
          {{ step.label }}
        </p>

        <!-- Receipt mockup -->
        <div
          v-if="step.type === 'receipt'"
          class="mt-2 rounded-md bg-white/[0.04] p-1.5 text-left text-[9px] text-white/40"
        >
          <p>Магнит</p>
          <p>Молоко...48₽</p>
          <p>Хлеб...35₽</p>
          <p class="mt-1 border-t border-dashed border-white/10 pt-1 font-semibold text-white">
            Итого: 83₽
          </p>
        </div>

        <!-- Processing bar -->
        <div v-if="step.type === 'processing'" class="mt-2 space-y-1">
          <div class="h-1 rounded-full bg-white/10">
            <div
              class="h-1 rounded-full bg-red-400 transition-all duration-1000 ease-out"
              :style="{ width: isVisible ? '80%' : '0%', transitionDelay: '0.8s' }"
            />
          </div>
          <p class="text-[8px] text-white/40">Сумма, категория, дата</p>
        </div>

        <!-- Result -->
        <div
          v-if="step.type === 'result'"
          class="mt-2 space-y-1.5"
        >
          <div class="rounded-md bg-emerald-500/10 p-1.5">
            <p class="text-xs font-bold text-white">−83 ₽</p>
            <p class="text-[9px] text-emerald-300">🛒 Продукты</p>
          </div>
          <div
            class="rounded-md bg-amber-500/10 p-1 transition-all duration-500"
            :class="isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
            :style="{ transitionDelay: '1.2s' }"
          >
            <p class="text-[8px] text-amber-300">👥 Долги созданы</p>
          </div>
        </div>
      </div>

      <!-- Arrow between steps -->
      <div
        v-if="i < steps.length - 1"
        class="text-xl text-red-400 transition-all duration-300"
        :class="isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'"
        :style="{ transitionDelay: `${0.15 + i * 0.3}s` }"
      >
        →
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/ReceiptFlow.vue
git commit -m "feat(onboarding): add ReceiptFlow component (3-step receipt → debts)"
```

---

### Task 8: FeatureCard component

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/components/FeatureCard.vue`

- [ ] **Step 1: Create FeatureCard.vue**

```vue
<script setup lang="ts">
defineProps<{
  isVisible: boolean
  delay: number
}>()
</script>

<template>
  <div
    class="rounded-xl border border-purple-500/15 bg-white/[0.06] p-4 transition-all duration-500"
    :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    :style="{ transitionDelay: `${delay}s` }"
  >
    <slot />
  </div>
</template>
```

- [ ] **Step 2: Create components index**

Create `frontend/src/pages/onboarding/welcome/components/index.ts`:

```typescript
export { default as ScrollHint } from './ScrollHint.vue'
export { default as BalanceCard } from './BalanceCard.vue'
export { default as DonutChart } from './DonutChart.vue'
export { default as DebtCard } from './DebtCard.vue'
export { default as ReceiptFlow } from './ReceiptFlow.vue'
export { default as FeatureCard } from './FeatureCard.vue'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/components/
git commit -m "feat(onboarding): add FeatureCard component and components index"
```

---

## Chunk 2: Landing Sections

### Task 9: HeroSection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/HeroSection.vue`

- [ ] **Step 1: Create HeroSection.vue**

```vue
<script setup lang="ts">
import { BalanceCard, ScrollHint } from '../components'
import { useSectionAnimation } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()
</script>

<template>
  <section
    ref="sectionRef"
    class="relative flex min-h-dvh items-center justify-center px-6 py-12"
    style="background: linear-gradient(180deg, #0f0a2e 0%, #1a1145 100%)"
  >
    <div
      class="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:gap-16"
    >
      <!-- Text -->
      <div
        class="flex-1 text-center transition-all duration-700 lg:text-left"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <p class="mb-2 text-xs font-medium uppercase tracking-[3px] text-violet-400">
          Ouro Finance
        </p>
        <h1 class="mb-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
          Ваши финансы.<br />Под контролем.
        </h1>
        <p
          class="mx-auto max-w-md text-sm text-white/50 transition-all duration-700 lg:mx-0 lg:text-base"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
          :style="{ transitionDelay: '0.2s' }"
        >
          Управляйте счетами, отслеживайте расходы, контролируйте долги — всё в одном приложении
        </p>
      </div>

      <!-- Balance Card -->
      <div
        class="w-full max-w-xs transition-all duration-700"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
        :style="{ transitionDelay: '0.3s' }"
      >
        <BalanceCard :is-visible="isVisible" />
      </div>
    </div>

    <!-- Scroll hint -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2">
      <ScrollHint />
    </div>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/HeroSection.vue
git commit -m "feat(onboarding): add HeroSection with animated balance card"
```

---

### Task 10: MultiCurrencySection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/MultiCurrencySection.vue`

- [ ] **Step 1: Create MultiCurrencySection.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSectionAnimation, useCountUp } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()

const accounts = [
  {
    icon: '💳',
    name: 'Visa Gold',
    gradient: 'from-indigo-500 to-violet-500',
    amount: 4200,
    currency: '$',
    sub: '€1,850 · ₽25,000',
  },
  {
    icon: '🏦',
    name: 'Сбережения',
    gradient: 'from-emerald-500 to-emerald-400',
    amount: 8500,
    currency: '€',
    sub: 'Депозит 6%',
  },
  {
    icon: '💵',
    name: 'Наличные',
    gradient: 'from-amber-500 to-amber-400',
    amount: 500000,
    currency: '',
    sub: 'UZS',
    formatSuffix: ' сўм',
  },
]

const displayAmounts = accounts.map((acc) => {
  const target = ref(acc.amount)
  return useCountUp(target, isVisible, {
    duration: 1200,
    format: (n) => {
      const formatted = Math.floor(n).toLocaleString('en-US')
      return `${acc.currency}${formatted}${acc.formatSuffix ?? ''}`
    },
  })
})
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #0c1222 0%, #111827 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-sky-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Мульти-валюта
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Все валюты — один счёт
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Храните USD, EUR, UZS и ещё 3 валюты на одном счёте
      </p>

      <!-- Account cards -->
      <div class="flex flex-wrap justify-center gap-3">
        <div
          v-for="(acc, i) in accounts"
          :key="i"
          class="w-40 rounded-xl border border-white/[0.08] bg-white/[0.06] p-3.5 text-left transition-all duration-500"
          :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
          :style="{ transitionDelay: `${0.2 + i * 0.15}s` }"
        >
          <div class="mb-2 flex items-center gap-1.5">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-sm"
              :class="acc.gradient"
            >
              {{ acc.icon }}
            </div>
            <span class="text-xs font-semibold text-white">{{ acc.name }}</span>
          </div>
          <p class="text-base font-extrabold text-white">{{ displayAmounts[i].value }}</p>
          <p class="mt-0.5 text-[10px] text-white/50">{{ acc.sub }}</p>
        </div>
      </div>

      <!-- Conversion rate -->
      <div
        class="mx-auto mt-5 max-w-md rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-2.5 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.65s' }"
      >
        <p class="text-xs text-indigo-300">$1 = 12,850 сўм · €0.92 · ₽89.5</p>
        <p class="mt-0.5 text-[10px] text-white/30">Курсы обновляются автоматически</p>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/MultiCurrencySection.vue
git commit -m "feat(onboarding): add MultiCurrencySection with animated accounts"
```

---

### Task 11: AnalyticsSection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/AnalyticsSection.vue`

- [ ] **Step 1: Create AnalyticsSection.vue**

```vue
<script setup lang="ts">
import { DonutChart } from '../components'
import { useSectionAnimation } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()

const periods = ['Неделя', 'Месяц', 'Год']
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #052e16 0%, #0a1f12 100%)"
  >
    <div class="mx-auto w-full max-w-3xl text-center">
      <p
        class="mb-1.5 text-xs font-medium uppercase tracking-[3px] text-emerald-400 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      >
        Аналитика
      </p>
      <h2
        class="mb-2 text-2xl font-extrabold text-white transition-all duration-500 sm:text-3xl"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.1s' }"
      >
        Знайте, куда уходят деньги
      </h2>
      <p
        class="mb-8 text-sm text-white/50 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.15s' }"
      >
        Детальная разбивка по категориям, периодам и трендам
      </p>

      <DonutChart :is-visible="isVisible" />

      <!-- Period tabs -->
      <div
        class="mt-5 flex justify-center gap-1 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
        :style="{ transitionDelay: '0.8s' }"
      >
        <span
          v-for="(period, i) in periods"
          :key="period"
          class="rounded-md px-3.5 py-1.5 text-xs"
          :class="i === 0
            ? 'bg-emerald-500/15 font-semibold text-emerald-400'
            : 'text-white/30'
          "
        >
          {{ period }}
        </span>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/AnalyticsSection.vue
git commit -m "feat(onboarding): add AnalyticsSection with animated donut chart"
```

---

### Task 12: DebtsSection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/DebtsSection.vue`

- [ ] **Step 1: Create DebtsSection.vue**

```vue
<script setup lang="ts">
import { DebtCard } from '../components'
import { useSectionAnimation } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/DebtsSection.vue
git commit -m "feat(onboarding): add DebtsSection with animated debt cards"
```

---

### Task 13: ReceiptScanSection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/ReceiptScanSection.vue`

- [ ] **Step 1: Create ReceiptScanSection.vue**

```vue
<script setup lang="ts">
import { ReceiptFlow } from '../components'
import { useSectionAnimation } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/ReceiptScanSection.vue
git commit -m "feat(onboarding): add ReceiptScanSection with receipt-to-debts flow"
```

---

### Task 14: FeaturesSection (Split, Categories, Quick Actions)

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue`

- [ ] **Step 1: Create FeaturesSection.vue**

```vue
<script setup lang="ts">
import { FeatureCard } from '../components'
import { useSectionAnimation } from '../composables'

const { sectionRef, isVisible } = useSectionAnimation()

const splitShares = [
  { name: 'Вы', color: 'bg-indigo-500/20 text-indigo-300', amount: '$25' },
  { name: 'Ахмед', color: 'bg-amber-500/20 text-amber-300', amount: '$25' },
  { name: 'Анна', color: 'bg-emerald-500/20 text-emerald-300', amount: '$25' },
]

const categories = [
  { emoji: '🛒', name: 'Продукты', color: 'bg-emerald-500/20 text-emerald-300' },
  { emoji: '🚗', name: 'Транспорт', color: 'bg-indigo-500/20 text-indigo-300' },
  { emoji: '🎮', name: 'Игры', color: 'bg-amber-500/20 text-amber-300' },
  { emoji: '☕', name: 'Кофе', color: 'bg-red-500/20 text-red-300' },
]

const quickActions = [
  { emoji: '🚇', name: 'Метро', amount: '−46₽' },
  { emoji: '☕', name: 'Кофе', amount: '−250₽' },
  { emoji: '🥗', name: 'Обед', amount: '−350₽' },
]
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
        <!-- Split expense -->
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

        <!-- Categories -->
        <FeatureCard :is-visible="isVisible" :delay="0.35" class="w-40 text-left sm:w-44">
          <p class="mb-2 text-2xl">🎨</p>
          <p class="mb-1 text-sm font-bold text-white">Свои категории</p>
          <p class="mb-3 text-[10px] text-white/50">
            Настройте под себя — иконки, цвета, порядок
          </p>
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

        <!-- Quick Actions -->
        <FeatureCard :is-visible="isVisible" :delay="0.5" class="w-40 text-left sm:w-44">
          <p class="mb-2 text-2xl">⚡</p>
          <p class="mb-1 text-sm font-bold text-white">Быстрые действия</p>
          <p class="mb-3 text-[10px] text-white/50">
            Одно нажатие — расход записан
          </p>
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue
git commit -m "feat(onboarding): add FeaturesSection (split, categories, quick actions)"
```

---

### Task 15: CtaSection

**Files:**
- Create: `frontend/src/pages/onboarding/welcome/sections/CtaSection.vue`

- [ ] **Step 1: Create CtaSection.vue**

The CTA section handles both "Начать бесплатно" (→ login?mode=register) and "Попробовать демо" (→ signInAnonymously). It sets `HAS_SEEN_ONBOARDING` on CTA click.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROUTE_NAMES } from '@/app/router/routeNames'
import { STORAGE_KEYS } from '@/shared/config/storageKeys'
import { useAuth } from '@/shared/api/composables/useAuth'
import { useSectionAnimation } from '../composables'

const router = useRouter()
const { signInAnonymously } = useAuth()
const { sectionRef, isVisible } = useSectionAnimation()

const isDemoLoading = ref(false)
const demoError = ref('')

function markOnboardingSeen() {
  localStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true')
}

function handleStart() {
  markOnboardingSeen()
  router.push({ name: ROUTE_NAMES.LOGIN, query: { mode: 'register' } })
}

async function handleDemo() {
  markOnboardingSeen()
  isDemoLoading.value = true
  demoError.value = ''
  try {
    const result = await signInAnonymously()
    if (result?.user) {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true')
      localStorage.setItem(STORAGE_KEYS.SELECTED_CURRENCY, result.user.currency)
      router.push({ name: ROUTE_NAMES.DASHBOARD })
    }
  } catch (e: any) {
    demoError.value = e?.message?.includes('429')
      ? 'Слишком много попыток. Попробуйте позже.'
      : 'Не удалось запустить демо. Попробуйте ещё раз.'
  } finally {
    isDemoLoading.value = false
  }
}
</script>

<template>
  <section
    ref="sectionRef"
    class="flex min-h-dvh items-center justify-center px-6 py-16"
    style="background: linear-gradient(180deg, #0f0a2e 0%, #1e1b4b 50%, #0f0a2e 100%)"
  >
    <div
      class="flex flex-col items-center text-center transition-all duration-700"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
    >
      <h2 class="mb-2 text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
        Готовы взять финансы<br />под контроль?
      </h2>
      <p class="mb-7 max-w-sm text-sm text-white/50">
        Присоединяйтесь бесплатно. Никаких скрытых платежей.
      </p>

      <div class="flex w-64 flex-col gap-2.5">
        <button
          class="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-shadow hover:shadow-xl hover:shadow-indigo-500/40"
          @click="handleStart"
        >
          Начать бесплатно
        </button>
        <button
          class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-8 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          :disabled="isDemoLoading"
          @click="handleDemo"
        >
          {{ isDemoLoading ? 'Загрузка...' : 'Попробовать демо' }}
        </button>
      </div>

      <p v-if="demoError" class="mt-3 text-xs text-red-400">{{ demoError }}</p>
      <p class="mt-4 text-[10px] text-white/25">
        Регистрация за 30 секунд • Без привязки карты
      </p>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Create sections index**

Create `frontend/src/pages/onboarding/welcome/sections/index.ts`:

```typescript
export { default as HeroSection } from './HeroSection.vue'
export { default as MultiCurrencySection } from './MultiCurrencySection.vue'
export { default as AnalyticsSection } from './AnalyticsSection.vue'
export { default as DebtsSection } from './DebtsSection.vue'
export { default as ReceiptScanSection } from './ReceiptScanSection.vue'
export { default as FeaturesSection } from './FeaturesSection.vue'
export { default as CtaSection } from './CtaSection.vue'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/
git commit -m "feat(onboarding): add CtaSection with register/demo actions and sections index"
```

---

## Chunk 3: Integration & Cleanup

### Task 16: Rewrite WelcomePage.vue

**Files:**
- Modify: `frontend/src/pages/onboarding/welcome/WelcomePage.vue` (complete rewrite)

- [ ] **Step 1: Rewrite WelcomePage.vue**

Replace the entire file with the new landing page container that assembles all 7 sections. Force dark class on the container.

```vue
<script setup lang="ts">
import {
  HeroSection,
  MultiCurrencySection,
  AnalyticsSection,
  DebtsSection,
  ReceiptScanSection,
  FeaturesSection,
  CtaSection,
} from './sections'
</script>

<template>
  <div class="dark">
    <main class="scroll-smooth">
      <HeroSection />
      <MultiCurrencySection />
      <AnalyticsSection />
      <DebtsSection />
      <ReceiptScanSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/WelcomePage.vue
git commit -m "feat(onboarding): rewrite WelcomePage as cinematic scroll landing"
```

---

### Task 17: Add mode=register query param to LoginPage

**Files:**
- Modify: `frontend/src/pages/auth/LoginPage.vue`

- [ ] **Step 1: Add route query param watcher**

Read `frontend/src/pages/auth/LoginPage.vue` first. Then find the `isSignUp` ref (should be around line 14) and add a watcher that auto-toggles based on `?mode=register` query param.

Add after the `isSignUp` ref declaration:

```typescript
import { useRoute } from 'vue-router'
// (ensure useRoute is imported — it may already be imported)

const route = useRoute()

// Auto-switch to register form when coming from landing CTA
watch(
  () => route.query.mode,
  (mode) => {
    if (mode === 'register') {
      isSignUp.value = true
    }
  },
  { immediate: true },
)
```

**Note:** Check if `watch` and `useRoute` are already imported. Only add what's missing.

- [ ] **Step 2: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/auth/LoginPage.vue
git commit -m "feat(auth): support mode=register query param for auto-toggling signup form"
```

---

### Task 18: Delete old carousel files

**Files:**
- Delete: `frontend/src/pages/onboarding/welcome/slides/WelcomeSlide.vue`
- Delete: `frontend/src/pages/onboarding/welcome/slides/AccountsSlide.vue`
- Delete: `frontend/src/pages/onboarding/welcome/slides/DebtsSlide.vue`
- Delete: `frontend/src/pages/onboarding/welcome/slides/AnalyticsSlide.vue`
- Delete: `frontend/src/pages/onboarding/welcome/slides/` directory
- Delete: `frontend/src/pages/onboarding/currency-selection/CurrencySelectionPage.vue`
- Delete: `frontend/src/pages/onboarding/currency-selection/` directory

- [ ] **Step 1: Delete old slide files**

```bash
rm -rf frontend/src/pages/onboarding/welcome/slides/
rm -rf frontend/src/pages/onboarding/currency-selection/
```

- [ ] **Step 2: Check for stale imports**

Search the codebase for any remaining imports of deleted files:

```bash
grep -r "slides/" frontend/src/pages/onboarding/ || echo "No stale imports"
grep -r "CurrencySelectionPage" frontend/src/ || echo "No stale imports"
grep -r "currency-selection" frontend/src/ || echo "No stale imports"
```

If any stale imports are found, remove them.

- [ ] **Step 3: Verify build**

Run: `cd frontend && bun run build`
Expected: Build succeeds with no errors about missing modules

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/pages/onboarding/welcome/slides/ frontend/src/pages/onboarding/currency-selection/
git commit -m "chore(onboarding): delete old carousel slides and legacy currency selection page"
```

---

### Task 19: Final build verification & accessibility check

- [ ] **Step 1: Full build check**

Run: `cd frontend && bun run build`
Expected: Build succeeds with 0 errors

- [ ] **Step 2: Verify prefers-reduced-motion**

Confirm that accessibility is handled at the composable level:
- `useCountUp` — skips animation and shows final value immediately when `prefers-reduced-motion: reduce`
- `useSectionAnimation` — returns `isVisible: true` immediately when `prefers-reduced-motion: reduce`, so all elements render visible without transitions

No additional CSS or code changes needed — it's baked in from Task 1 and Task 2.

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(onboarding): complete cinematic scroll landing page redesign

Replaces mobile-only swipe carousel with a 7-section scroll-animated
landing page. Each section reveals with Intersection Observer-driven
CSS transitions. Forced dark theme. Responsive for desktop/tablet/mobile.

Sections: Hero, Multi-currency, Analytics, Debts, Receipt scanning,
Features (split/categories/quick actions), CTA.

Includes prefers-reduced-motion accessibility support."
```

---

### Task 20: Update changelog

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Add changelog entry**

Read the file first to get the current version. Add a new entry at the top of `CHANGELOG_ENTRIES` with bumped patch version:

Also update `CURRENT_VERSION` at the top of the file to match.

```typescript
{
  version: '1.0.31',
  date: '2026-03-12',
  title: 'Новый экран приветствия',
  items: [
    {
      type: 'feature',
      text: 'Полностью переработан экран приветствия — теперь это красивый лендинг с анимациями, адаптированный для веба и мобильных устройств',
    },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "docs: add changelog entry for onboarding redesign"
```
