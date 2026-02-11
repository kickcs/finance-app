<script setup lang="ts">
import { ref, computed, onMounted, provide, shallowRef } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from '@/features/toggle-theme'
import { initializeAuth, useAuth, useProfile } from '@/shared/api'
import { transitionName } from '@/app/router'
import { useCategories } from '@/entities/category'
import { ToastProvider, Toaster } from '@/shared/ui/primitives/toast'
import { DemoBanner, useDemoMode } from '@/features/demo-mode'

// Initialize theme synchronously on script setup (before mount)
const { initTheme } = useTheme()
initTheme()

// Auth state
const { user, isLoading: authLoading, isAuthenticated } = useAuth()
const isAppReady = ref(false)

// Categories - get getCategoryById for global use
const userId = computed(() => user.value?.id ?? null)
const { getCategoryById } = useCategories(userId)

// Get user profile for demo mode
const { profile } = useProfile(userId)

// Demo mode
const { isDemo, formattedRemaining } = useDemoMode(profile)

// Initialize auth on app mount
onMounted(async () => {
  // Start auth initialization immediately
  await initializeAuth()
  isAppReady.value = true
})

// Provide auth state to all components
provide('user', user)
provide('isAuthenticated', isAuthenticated)
provide('getCategoryById', getCategoryById)
</script>

<template>
  <ToastProvider>
    <div class="min-h-screen bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark antialiased relative overflow-x-hidden">
      <!-- Loading state while auth initializes -->
      <div
        v-if="!isAppReady"
        class="min-h-screen flex items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>

      <template v-if="isAppReady">
        <!-- Demo Banner - shown globally when in demo mode -->
        <DemoBanner v-if="isDemo" :formatted-remaining="formattedRemaining" />

        <!-- App content -->
        <RouterView v-slot="{ Component, route }">
          <!-- When transitionName is 'none' (browser gesture), skip Transition entirely -->
          <component v-if="transitionName === 'none'" :is="Component" :key="route.path" />
          <Transition v-else :name="transitionName">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </template>
    </div>

    <!-- Toast notifications -->
    <Toaster />
  </ToastProvider>
</template>

<style>
/* Page Transitions - smooth iOS-like navigation */

/* Fade transition - for main tab navigation */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide forward - navigating deeper into the app */
.slide-forward-enter-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 10;
}

.slide-forward-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
              opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 5;
}

.slide-forward-enter-from {
  transform: translateX(100%);
}

.slide-forward-enter-to {
  transform: translateX(0);
}

.slide-forward-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.slide-forward-leave-to {
  transform: translateX(-25%);
  opacity: 0.6;
}

/* Slide back - returning to previous screen */
.slide-back-enter-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
              opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 5;
}

.slide-back-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 10;
}

.slide-back-enter-from {
  transform: translateX(-25%);
  opacity: 0.6;
}

.slide-back-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.slide-back-leave-from {
  transform: translateX(0);
}

.slide-back-leave-to {
  transform: translateX(100%);
}

/* Common transition container styles */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

/* No transition - handled by skipping Transition component entirely in template */

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .slide-forward-enter-active,
  .slide-forward-leave-active,
  .slide-back-enter-active,
  .slide-back-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none !important;
  }
}
</style>
