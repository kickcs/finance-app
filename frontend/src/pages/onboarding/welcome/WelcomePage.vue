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
    <main class="welcome-landing scroll-smooth">
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

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .welcome-landing :deep(.transition-all),
  .welcome-landing :deep([class*='transition-']) {
    transition: none !important;
  }
}
</style>
