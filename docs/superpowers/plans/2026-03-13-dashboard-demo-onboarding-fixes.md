# Dashboard, Demo Layout, Onboarding Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 frontend issues: reorder budget widget, fix demo banner sidebar overflow, optimize onboarding load speed, fix title overflow on mobile.

**Architecture:** All changes are frontend-only. Each fix is independent — no shared state between tasks.

**Tech Stack:** Vue 3, Tailwind CSS v4, VueUse, defineAsyncComponent

---

## Task 1: Reorder Budget Widget in Default Dashboard Order

**Files:**
- Modify: `frontend/src/shared/config/dashboard.ts`

- [ ] **Step 1: Move `budget` after `transactions` in DEFAULT_WIDGET_ORDER**

In `frontend/src/shared/config/dashboard.ts`, change the array to:

```typescript
export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'quick_actions',
  'accounts',
  'top_expenses',
  'transactions',
  'budget',
  'debts',
  'reminders',
];
```

- [ ] **Step 2: Verify build passes**

Run: `cd frontend && bun run build`
Expected: No type errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/config/dashboard.ts
git commit -m "fix(dashboard): move budget widget after transactions in default order"
```

---

## Task 2: Fix Demo Banner Pushing Sidebar Below Viewport

**Files:**
- Modify: `frontend/src/app/App.vue`
- Modify: `frontend/src/app/layouts/ui/MainLayout.vue`

The problem: DemoBanner sits above MainLayout in the DOM. MainLayout uses `h-dvh`, so the total height is `banner_height + 100dvh`, pushing the sidebar's bottom "Add Transaction" button off-screen.

The fix: When demo mode is active, App.vue wraps content in a flex column constrained to `h-dvh`. MainLayout detects this via `provide/inject` and uses `flex-1 min-h-0` instead of `h-dvh`.

- [ ] **Step 1: Provide `isDemo` from App.vue**

In `frontend/src/app/App.vue`, add after line 78 (`provide('getCategoryById', getCategoryById);`):

```typescript
provide('isDemo', isDemo);
```

- [ ] **Step 2: Add conditional classes to App.vue outer div**

In `frontend/src/app/App.vue`, change the outer div (line 83-85) from:

```html
<div
  class="min-h-screen bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark antialiased relative overflow-x-hidden"
>
```

To:

```html
<div
  :class="[
    'bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark antialiased relative',
    isDemo ? 'h-dvh flex flex-col overflow-hidden' : 'min-h-screen overflow-x-hidden',
  ]"
>
```

- [ ] **Step 3: Update MainLayout to use flex-1 when in demo mode**

In `frontend/src/app/layouts/ui/MainLayout.vue`, inject `isDemo` and conditionally change the root class:

Add to `<script setup>`:

```typescript
import { inject } from 'vue';
const isDemo = inject<import('vue').Ref<boolean>>('isDemo', ref(false));
```

Change the root div (line 25) from:

```html
<div class="h-dvh w-full flex overflow-hidden bg-background-light dark:bg-background-dark">
```

To:

```html
<div :class="[
  'w-full flex overflow-hidden bg-background-light dark:bg-background-dark',
  isDemo ? 'flex-1 min-h-0' : 'h-dvh',
]">
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && bun run build`
Expected: No type errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/App.vue frontend/src/app/layouts/ui/MainLayout.vue
git commit -m "fix(layout): prevent demo banner from pushing sidebar off-screen"
```

---

## Task 3: Optimize Onboarding Welcome Page Load Speed

**Files:**
- Modify: `frontend/src/pages/onboarding/welcome/WelcomePage.vue`
- Modify: `frontend/src/pages/onboarding/welcome/composables/useScrollAnimations.ts`

### Step-by-step:

- [ ] **Step 1: Add `rootMargin` option and `shouldRender` ref to useSectionAnimation**

In `frontend/src/pages/onboarding/welcome/composables/useScrollAnimations.ts`, replace the entire file:

```typescript
import { ref, watchEffect } from 'vue';
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core';

export function useSectionAnimation(options: { threshold?: number } = {}) {
  const { threshold = 0.2 } = options;
  const sectionRef = ref<HTMLElement | null>(null);
  const isVisible = ref(false);
  const prefersReducedMotion = usePreferredReducedMotion();

  watchEffect(() => {
    if (prefersReducedMotion.value === 'reduce') {
      isVisible.value = true;
    }
  });

  const { stop } = useIntersectionObserver(
    sectionRef,
    ([entry]) => {
      if (entry?.isIntersecting) {
        isVisible.value = true;
        stop();
      }
    },
    { threshold },
  );

  return { sectionRef, isVisible };
}

/**
 * Lazy section renderer — mounts component when sentinel enters rootMargin zone.
 * Use with v-if="shouldRender" on the actual component and ref="sentinelRef" on a placeholder div.
 */
export function useLazyRender(rootMargin = '200px') {
  const sentinelRef = ref<HTMLElement | null>(null);
  const shouldRender = ref(false);
  const prefersReducedMotion = usePreferredReducedMotion();

  watchEffect(() => {
    if (prefersReducedMotion.value === 'reduce') {
      shouldRender.value = true;
    }
  });

  const { stop } = useIntersectionObserver(
    sentinelRef,
    ([entry]) => {
      if (entry?.isIntersecting) {
        shouldRender.value = true;
        stop();
      }
    },
    { rootMargin },
  );

  return { sentinelRef, shouldRender };
}
```

- [ ] **Step 2: Export useLazyRender from composables index**

In `frontend/src/pages/onboarding/welcome/composables/index.ts`, add:

```typescript
export { useLazyRender } from './useScrollAnimations';
```

(Keep `useSectionAnimation` export unchanged.)

- [ ] **Step 3: Rewrite WelcomePage.vue with lazy sections and inline @font-face**

Replace `frontend/src/pages/onboarding/welcome/WelcomePage.vue` entirely:

```vue
<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue';
import { useWindowScroll, useWindowSize, useResizeObserver } from '@vueuse/core';
import { HeroSection } from './sections';
import { useLazyRender } from './composables';

// Lazy-loaded sections (code-split)
const MultiCurrencySection = defineAsyncComponent(() => import('./sections/MultiCurrencySection.vue'));
const AnalyticsSection = defineAsyncComponent(() => import('./sections/AnalyticsSection.vue'));
const DebtsSection = defineAsyncComponent(() => import('./sections/DebtsSection.vue'));
const ReceiptScanSection = defineAsyncComponent(() => import('./sections/ReceiptScanSection.vue'));
const FeaturesSection = defineAsyncComponent(() => import('./sections/FeaturesSection.vue'));
const CtaSection = defineAsyncComponent(() => import('./sections/CtaSection.vue'));

// Lazy render sentinels
const { sentinelRef: multiCurrencyRef, shouldRender: showMultiCurrency } = useLazyRender();
const { sentinelRef: analyticsRef, shouldRender: showAnalytics } = useLazyRender();
const { sentinelRef: debtsRef, shouldRender: showDebts } = useLazyRender();
const { sentinelRef: receiptRef, shouldRender: showReceipt } = useLazyRender();
const { sentinelRef: featuresRef, shouldRender: showFeatures } = useLazyRender();
const { sentinelRef: ctaRef, shouldRender: showCta } = useLazyRender();

const { y } = useWindowScroll();
const { height } = useWindowSize();
const documentHeight = ref(document.documentElement.scrollHeight);
useResizeObserver(document.documentElement, () => {
  documentHeight.value = document.documentElement.scrollHeight;
});

const scrollProgress = computed(() => {
  const maxScroll = documentHeight.value - height.value;
  return maxScroll > 0 ? (y.value / maxScroll) * 100 : 0;
});
</script>

<template>
  <div class="dark">
    <!-- Premium Scroll Progress Bar -->
    <div class="fixed top-0 left-0 right-0 h-1 z-[100] bg-white/5 backdrop-blur-sm">
      <div
        class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] transition-all duration-150 ease-out"
        :style="{ width: `${scrollProgress}%` }"
      />
    </div>

    <main class="welcome-landing">
      <div class="noise-overlay" aria-hidden="true" />
      <HeroSection />

      <div ref="multiCurrencyRef" />
      <MultiCurrencySection v-if="showMultiCurrency" />

      <div ref="analyticsRef" />
      <AnalyticsSection v-if="showAnalytics" />

      <div ref="debtsRef" />
      <DebtsSection v-if="showDebts" />

      <div ref="receiptRef" />
      <ReceiptScanSection v-if="showReceipt" />

      <div ref="featuresRef" />
      <FeaturesSection v-if="showFeatures" />

      <div ref="ctaRef" />
      <CtaSection v-if="showCta" />
    </main>
  </div>
</template>

<style>
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/unbounded/v7/Yq6W-LOTXCb04q32xlpat-6uR42XTqtG65jcIg.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/unbounded/v7/Yq6W-LOTXCb04q32xlpat-6uR42XTqtG65jcIg.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/unbounded/v7/Yq6W-LOTXCb04q32xlpat-6uR42XTqtG65jcIg.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face {
  font-family: 'Unbounded';
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url('https://fonts.gstatic.com/s/unbounded/v7/Yq6W-LOTXCb04q32xlpat-6uR42XTqtG65jcIg.woff2') format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}

.welcome-landing {
  scroll-behavior: smooth;
  overflow-x: hidden;
  background-color: #050505;
  color: #fafafa;
}

.welcome-landing h1,
.welcome-landing h2,
.welcome-landing h3,
.welcome-landing h4 {
  font-family: 'Unbounded', 'Arial Black', sans-serif;
  letter-spacing: -0.04em;
}

.welcome-section {
  position: relative;
  isolation: isolate;
}

.welcome-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: center;
  pointer-events: none;
  z-index: 0;
}

.welcome-landing::-webkit-scrollbar {
  width: 10px;
}
.welcome-landing::-webkit-scrollbar-track {
  background: #050505;
}
.welcome-landing::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  border: 2px solid #050505;
}
.welcome-landing::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.glass-card {
  background: rgba(20, 20, 22, 0.5);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}

.gradient-border {
  position: relative;
}

.gradient-border::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.2),
    rgba(255, 255, 255, 0.02) 40%,
    rgba(255, 255, 255, 0.01) 60%,
    rgba(255, 255, 255, 0.1)
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  pointer-events: none;
}

@keyframes glow-pulse {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(99, 102, 241, 0.4),
      0 0 60px rgba(99, 102, 241, 0.1);
  }
  50% {
    box-shadow:
      0 0 35px rgba(99, 102, 241, 0.6),
      0 0 90px rgba(99, 102, 241, 0.2);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes scroll-line {
  0% {
    transform: scaleY(0);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    transform: scaleY(1);
    opacity: 0;
  }
}
</style>

<style scoped>
.noise-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

@media (prefers-reduced-motion: reduce) {
  .welcome-landing * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && bun run build`
Expected: No type errors, build succeeds. Check that sections are code-split (separate chunks in dist).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/
git commit -m "perf(onboarding): lazy-load sections and replace @import with @font-face"
```

---

## Task 4: Fix Title Overflow on Mobile

**Files:**
- Modify: `frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue`

- [ ] **Step 1: Reduce font size on mobile**

In `frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue`, change line 71 from:

```html
<h2 class="mb-4 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
```

To:

```html
<h2 class="mb-4 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
```

- [ ] **Step 2: Verify build passes**

Run: `cd frontend && bun run build`
Expected: No type errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/onboarding/welcome/sections/FeaturesSection.vue
git commit -m "fix(onboarding): reduce title font size to prevent overflow on mobile"
```
