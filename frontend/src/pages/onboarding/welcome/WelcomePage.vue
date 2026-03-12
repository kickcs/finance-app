<script setup lang="ts">
import {
  HeroSection,
  MultiCurrencySection,
  AnalyticsSection,
  DebtsSection,
  ReceiptScanSection,
  FeaturesSection,
  CtaSection,
} from './sections';
</script>

<template>
  <div class="dark">
    <main class="welcome-landing">
      <div class="noise-overlay" aria-hidden="true" />
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

<style>
@import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&subset=cyrillic&display=swap');

.welcome-landing {
  scroll-behavior: smooth;
  overflow-x: hidden;
}

.welcome-landing h1,
.welcome-landing h2 {
  font-family: 'Unbounded', 'Arial Black', sans-serif;
  letter-spacing: -0.03em;
}

.welcome-section {
  position: relative;
  isolation: isolate;
}

.welcome-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}

.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
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
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.02),
    rgba(255, 255, 255, 0.08)
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
      0 0 20px rgba(99, 102, 241, 0.3),
      0 0 60px rgba(99, 102, 241, 0.08);
  }
  50% {
    box-shadow:
      0 0 30px rgba(99, 102, 241, 0.5),
      0 0 80px rgba(99, 102, 241, 0.15);
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
  opacity: 0.02;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

@media (prefers-reduced-motion: reduce) {
  .welcome-landing :deep(.transition-all),
  .welcome-landing :deep([class*='transition-']),
  .welcome-landing :deep([class*='duration-']) {
    transition: none !important;
    animation: none !important;
  }
}
</style>
