<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { UButton } from '@/shared/ui';
import WelcomeSlide from './slides/WelcomeSlide.vue';
import AccountsSlide from './slides/AccountsSlide.vue';
import DebtsSlide from './slides/DebtsSlide.vue';
import AnalyticsSlide from './slides/AnalyticsSlide.vue';

const SWIPE_THRESHOLD_PX = 50;
const DEFAULT_VIEWPORT_WIDTH = 375;
const TOTAL_SLIDES = 4;

const router = useRouter();
const currentSlide = ref(0);
const containerRef = ref<HTMLElement | null>(null);

// Touch handling
const touchStartX = ref(0);
const touchDeltaX = ref(0);
const isSwiping = ref(false);
const cachedWidth = ref(DEFAULT_VIEWPORT_WIDTH);

const isLastSlide = computed(() => currentSlide.value === TOTAL_SLIDES - 1);

function nextSlide() {
  if (currentSlide.value < TOTAL_SLIDES - 1) {
    currentSlide.value++;
  } else {
    completeOnboarding();
  }
}

function goToSlide(index: number) {
  currentSlide.value = index;
}

function skip() {
  completeOnboarding();
}

function completeOnboarding() {
  localStorage.setItem('hasSeenOnboarding', 'true');
  router.push({ name: 'login' });
}

function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX;
  touchDeltaX.value = 0;
  isSwiping.value = true;
  if (containerRef.value) {
    cachedWidth.value = containerRef.value.offsetWidth;
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isSwiping.value) return;
  touchDeltaX.value = e.touches[0].clientX - touchStartX.value;
}

function onTouchEnd() {
  if (!isSwiping.value) return;
  isSwiping.value = false;

  if (
    touchDeltaX.value < -SWIPE_THRESHOLD_PX &&
    currentSlide.value < TOTAL_SLIDES - 1
  ) {
    currentSlide.value++;
  } else if (touchDeltaX.value > SWIPE_THRESHOLD_PX && currentSlide.value > 0) {
    currentSlide.value--;
  }
  touchDeltaX.value = 0;
}

const carouselTransform = computed(() => {
  const baseOffset = -currentSlide.value * 100;
  const swipeOffset = isSwiping.value
    ? (touchDeltaX.value / (cachedWidth.value || DEFAULT_VIEWPORT_WIDTH)) * 100
    : 0;
  return `translateX(${baseOffset + swipeOffset}%)`;
});
</script>

<template>
  <div
    ref="containerRef"
    class="h-dvh flex flex-col bg-background-dark overflow-hidden relative select-none"
  >
    <!-- Skip button -->
    <header
      class="safe-area-inset-top px-6 py-4 flex justify-end items-center z-50 relative"
    >
      <button
        v-if="!isLastSlide"
        class="text-text-tertiary-dark hover:text-text-primary-dark transition-colors font-medium text-sm"
        @click="skip"
      >
        Пропустить
      </button>
    </header>

    <!-- Slides container -->
    <div
      class="flex-1 overflow-hidden"
      @touchstart="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div
        class="h-full flex"
        :class="{ 'transition-transform duration-300 ease-out': !isSwiping }"
        :style="{ transform: carouselTransform, willChange: 'transform' }"
      >
        <WelcomeSlide />
        <AccountsSlide />
        <DebtsSlide />
        <AnalyticsSlide />
      </div>
    </div>

    <!-- Bottom section: dots + button -->
    <footer
      class="safe-area-inset-bottom px-6 pb-8 pt-2 flex flex-col items-center gap-6 w-full z-20 relative"
    >
      <!-- Dot indicators -->
      <div class="flex gap-2">
        <button
          v-for="i in TOTAL_SLIDES"
          :key="i"
          class="h-2 w-2 rounded-full transition-colors"
          :class="
            currentSlide === i - 1 ? 'bg-primary' : 'bg-text-tertiary-dark/30'
          "
          :aria-label="`Слайд ${i}`"
          @click="goToSlide(i - 1)"
        />
      </div>

      <!-- Action button -->
      <UButton
        variant="primary"
        size="xl"
        full-width
        class="!h-14 !rounded-xl !text-lg !font-semibold"
        @click="nextSlide"
      >
        {{ isLastSlide ? 'Начать' : 'Далее' }}
      </UButton>
    </footer>
  </div>
</template>
