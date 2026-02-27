<script setup lang="ts">
import { ref, computed, onMounted, provide, defineAsyncComponent } from 'vue';
import { RouterView } from 'vue-router';
import { useTheme } from '@/features/toggle-theme';
import { initializeAuth, useAuth } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { transitionName } from '@/app/router';
import { useCategories } from '@/entities/category/api/useCategories';
import { ToastProvider, Toaster } from '@/shared/ui/primitives/toast';
import { DemoBanner, useDemoMode } from '@/features/demo-mode';
import { useChangelog } from '@/features/changelog/model/useChangelog';
import { NavigationProgress } from '@/shared/ui/navigation-progress';
import { usePwaUpdate } from '@/shared/lib/composables/usePwaUpdate';
import { usePremiumFeature } from '@/shared/lib/composables/usePremiumFeature';
import { useSubscription } from '@/entities/subscription/api/useSubscription';

// Lazy-loaded modals (rarely shown, loaded on demand)
const ChangelogModal = defineAsyncComponent(
  () => import('@/features/changelog/ui/ChangelogModal.vue'),
);
const PremiumUpgradeModal = defineAsyncComponent(
  () => import('@/features/upgrade-to-premium/ui/PremiumUpgradeModal.vue'),
);

// Initialize theme synchronously on script setup (before mount)
const { initTheme } = useTheme();
initTheme();

// Initialize PWA updates watcher
usePwaUpdate();

// Auth state
const { user, isLoading: _authLoading, isAuthenticated } = useAuth();
const isAppReady = ref(false);

// Categories - get getCategoryById for global use
const userId = computed(() => user.value?.id ?? null);
const { getCategoryById } = useCategories(userId);

// Premium subscription (global singleton)
const { isPremium, subscription } = useSubscription(userId);
const { showUpgradeModal, upgradeFeatureName, init: initPremium } = usePremiumFeature();
initPremium({ isPremium, subscription });

// Get user profile for demo mode
const { profile } = useProfile(userId);

// Demo mode
const { isDemo, formattedRemaining } = useDemoMode(profile);

// Changelog modal
const { hasUnseenChanges } = useChangelog();
const showChangelogModal = ref(false);

// Initialize auth on app mount
onMounted(async () => {
  // Start auth initialization immediately
  await initializeAuth();

  // Wait for router to be ready before removing skeleton
  import('@/app/router').then(async ({ router }) => {
    await router.isReady();
    isAppReady.value = true;

    // Add class to body to trigger CSS transition for skeleton hiding
    document.body.classList.add('app-ready');
  });

  // Show changelog modal if there are unseen changes
  if (isAuthenticated.value && hasUnseenChanges.value) {
    showChangelogModal.value = true;
  }
});

// Provide auth state to all components
provide('user', user);
provide('isAuthenticated', isAuthenticated);
provide('getCategoryById', getCategoryById);
</script>

<template>
  <ToastProvider>
    <div
      class="min-h-screen bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark antialiased relative overflow-x-hidden"
    >
      <!-- Navigation progress bar -->
      <NavigationProgress />

      <!-- Loading state while auth/router initializes -->
      <div v-if="!isAppReady" class="min-h-screen opacity-0"></div>

      <!-- Demo Banner - shown globally when in demo mode -->
      <DemoBanner v-if="isDemo" :formatted-remaining="formattedRemaining" />

      <!-- App content -->
      <RouterView v-slot="{ Component, route }">
        <!-- Skip transitions in App.vue for nested routes (they are handled in MainLayout) -->
        <component
          :is="Component"
          v-if="transitionName === 'none' || route.matched.length > 1"
          :key="route.matched[0]?.path ?? route.path"
        />
        <Transition v-else :name="transitionName">
          <component :is="Component" :key="route.matched[0]?.path ?? route.path" />
        </Transition>
      </RouterView>
    </div>

    <!-- Changelog modal -->
    <ChangelogModal v-if="showChangelogModal" v-model="showChangelogModal" />

    <!-- Premium upgrade modal (global) -->
    <PremiumUpgradeModal
      v-if="showUpgradeModal"
      v-model="showUpgradeModal"
      :feature-name="upgradeFeatureName"
    />

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
  transition:
    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
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
  transform: translateX(-15%);
  opacity: 0;
}

/* Slide back - returning to previous screen */
.slide-back-enter-active {
  transition:
    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
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

/* Slide-tab — directional slide-fade for bottom tab navigation */
.slide-tab-forward-enter-active,
.slide-tab-backward-enter-active {
  transition:
    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  transition-delay: 0.05s;
}

.slide-tab-forward-leave-active,
.slide-tab-backward-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-tab-forward-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-tab-forward-leave-to {
  transform: translateX(-40px) scale(0.98);
  opacity: 0;
}
.slide-tab-backward-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-tab-backward-leave-to {
  transform: translateX(40px) scale(0.98);
  opacity: 0;
}

/* Common transition container styles */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active,
.slide-tab-forward-enter-active,
.slide-tab-forward-leave-active,
.slide-tab-backward-enter-active,
.slide-tab-backward-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* GPU acceleration for slide transitions (not tab - translateZ conflicts with translateX) */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
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
  .slide-tab-forward-enter-active,
  .slide-tab-forward-leave-active,
  .slide-tab-backward-enter-active,
  .slide-tab-backward-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none !important;
  }
}
</style>
