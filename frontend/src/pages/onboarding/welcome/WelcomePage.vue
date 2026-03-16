<script setup lang="ts">
import { computed, ref, defineAsyncComponent, onMounted } from 'vue';
import { useWindowScroll, useWindowSize, useResizeObserver } from '@vueuse/core';
import { HeroSection } from './sections';
import { useLazyRender } from './composables';

// Lazy-loaded sections (code-split)
const MultiCurrencySection = defineAsyncComponent(
  () => import('./sections/MultiCurrencySection.vue'),
);
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

// Load Unbounded font asynchronously (non-blocking, replaces @import)
const FONT_LINK_ID = 'unbounded-font';
onMounted(() => {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;800;900&subset=cyrillic&display=swap';
  document.head.appendChild(link);
});

const { y } = useWindowScroll();
const { height } = useWindowSize();
const documentHeight = ref(0);
useResizeObserver(document.body, () => {
  documentHeight.value = document.documentElement.scrollHeight;
});

const scrollProgress = computed(() => {
  const maxScroll = documentHeight.value - height.value;
  return maxScroll > 0 ? Math.min((y.value / maxScroll) * 100, 100) : 0;
});
</script>

<template>
  <div class="dark">
    <!-- Premium Scroll Progress Bar -->
    <div class="fixed top-0 left-0 right-0 h-1 z-[100] bg-white/5">
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
.welcome-landing {
  scroll-behavior: smooth;
  overflow-x: hidden;
  background-color: #050505; /* Deep overarching background */
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

/* Base mesh overlay pattern for consistency */
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

/* Scoped Webkit Scrollbar for landing page */
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

/* Premium Glass Card */
.glass-card {
  background: rgba(20, 20, 22, 0.5);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}

/* Enhanced Gradient Border for Cards */
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
/* Subtle grain overlay */
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
