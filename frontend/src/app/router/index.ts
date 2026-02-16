import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { waitForAuth } from '@/shared/api/composables/useAuth';
import { clearTokens } from '@/shared/api/http';
import { queryClient } from '@/shared/api/queryClient';
import { queryKeys } from '@/shared/api/queryKeys';
import { profileApi } from '@/shared/api/services/profileApi';
import type { Profile } from '@/shared/api/database.types';

// Navigation direction state for page transitions
export const transitionName = ref<
  'slide-forward' | 'slide-back' | 'fade' | 'none'
>('fade');

// Prefetch critical page components for faster navigation
const prefetchPages = () => {
  // Prefetch main navigation pages after initial load
  const idle = requestIdleCallback?.(() => {
    import('@/pages/history/HistoryPage.vue');
    import('@/pages/analytics/AnalyticsPage.vue');
    import('@/pages/profile/ProfilePage.vue');
    import('@/pages/transactions/new/AddTransactionPage.vue');
  });
  if (idle === undefined) {
    setTimeout(() => {
      import('@/pages/history/HistoryPage.vue');
      import('@/pages/analytics/AnalyticsPage.vue');
      import('@/pages/profile/ProfilePage.vue');
      import('@/pages/transactions/new/AddTransactionPage.vue');
    }, 2000);
  }
};

// Track if current navigation is from browser back/forward (popstate)
let isPopStateNavigation = false;
let popStateTimestamp = 0;

// Listen for browser back/forward navigation
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    isPopStateNavigation = true;
    popStateTimestamp = Date.now();
  });
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    // If browser has saved position (back/forward navigation), restore it
    if (savedPosition) {
      return savedPosition;
    }
    // Otherwise scroll to top for new navigation
    return { top: 0 };
  },
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/pages/dashboard/DashboardPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    // Welcome onboarding (pre-auth)
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('@/pages/onboarding/welcome/WelcomePage.vue'),
      meta: { guestOnly: true },
    },
    // Auth routes
    {
      path: '/auth/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/pages/auth/AuthCallbackPage.vue'),
    },
    // Onboarding - only first account creation (currency is selected per-account now)
    {
      path: '/onboarding/first-account',
      name: 'first-account',
      component: () =>
        import('@/pages/onboarding/first-account/FirstAccountPage.vue'),
      meta: { requiresAuth: true },
    },
    // Legacy redirect for old currency selection route
    {
      path: '/onboarding/currency',
      redirect: '/onboarding/first-account',
    },
    // Main App
    {
      path: '/history',
      name: 'history',
      component: () => import('@/pages/history/HistoryPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/pages/analytics/AnalyticsPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/analytics/full',
      name: 'analytics-full',
      component: () => import('@/pages/analytics/AnalyticsFullPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('@/pages/accounts/AccountsPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/accounts/new',
      name: 'new-account',
      component: () =>
        import('@/pages/onboarding/first-account/FirstAccountPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/accounts/:id',
      name: 'account-detail',
      component: () => import('@/pages/accounts/AccountDetailPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/transactions/new',
      name: 'new-transaction',
      component: () =>
        import('@/pages/transactions/new/AddTransactionPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/reminders/new',
      name: 'new-reminder',
      component: () => import('@/pages/reminders/new/AddReminderPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/reminders/:id',
      name: 'reminder-detail',
      component: () =>
        import('@/pages/reminders/detail/ReminderDetailPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/reminders',
      name: 'reminders-list',
      component: () => import('@/pages/reminders/list/RemindersListPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    // Debts
    {
      path: '/debts',
      name: 'debts-list',
      component: () => import('@/pages/debts/list/DebtsListPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/debts/new',
      name: 'new-debt',
      component: () => import('@/pages/debts/new/AddDebtPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/debts/:id',
      name: 'debt-detail',
      component: () => import('@/pages/debts/detail/DebtDetailPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/pages/profile/ProfilePage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    // Changelog
    {
      path: '/changelog',
      name: 'changelog',
      component: () => import('@/pages/changelog/ChangelogPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    // Settings
    {
      path: '/settings/currency',
      name: 'settings-currency',
      component: () =>
        import('@/pages/settings/currency/CurrencySettingsPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/settings/import',
      name: 'settings-import',
      component: () =>
        import('@/pages/settings/import/ImportPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    {
      path: '/settings/categories',
      name: 'settings-categories',
      component: () => import('@/pages/settings/categories/CategoriesPage.vue'),
      meta: { requiresAuth: true, requiresOnboarding: true },
    },
    // Catch-all redirect
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

// Get profile from cache or fetch it
async function getOrFetchProfile(userId: string): Promise<Profile | null> {
  const queryKey = queryKeys.profile.detail(userId);

  // Try to get from cache first
  const cached = queryClient.getQueryData<Profile | null>(queryKey);
  if (cached !== undefined) return cached;

  // If not cached, fetch and cache
  try {
    return await queryClient.fetchQuery({
      queryKey,
      queryFn: () => profileApi.getById(userId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  } catch (err) {
    console.warn('Could not fetch profile:', err);
    return null;
  }
}

// In-memory flag to skip repeated onboarding checks after first success
let onboardingVerified = false;

// Reset onboarding verification flag (call on logout/user switch)
export function resetOnboardingVerified() {
  onboardingVerified = false;
}

// Helper function to check onboarding status
async function checkOnboardingStatus(userId: string): Promise<boolean> {
  // Skip network/cache check if already verified this session
  if (onboardingVerified) return true;

  // First check localStorage for fast response
  const localOnboarding = localStorage.getItem('onboardingComplete') === 'true';

  const profile = await getOrFetchProfile(userId);

  if (profile) {
    // Sync localStorage with database
    if (profile.has_completed_onboarding) {
      localStorage.setItem('onboardingComplete', 'true');
      onboardingVerified = true;
    }
    if (profile.currency) {
      localStorage.setItem('selectedCurrency', profile.currency);
    }
    return profile.has_completed_onboarding;
  }

  // Fallback to localStorage
  if (localOnboarding) {
    onboardingVerified = true;
  }
  return localOnboarding;
}

function hasSeenOnboarding(): boolean {
  return localStorage.getItem('hasSeenOnboarding') === 'true';
}

// Helper function to check if demo account has expired
async function checkDemoExpiry(userId: string): Promise<boolean> {
  const profile = await getOrFetchProfile(userId);

  if (!profile?.is_demo || !profile.demo_expires_at) {
    return false;
  }

  return new Date(profile.demo_expires_at) < new Date();
}

// Navigation guard for auth and onboarding
router.beforeEach(async (to, from, next) => {
  // Wait for auth to initialize
  const user = await waitForAuth();
  const isAuthenticated = !!user;

  // Check if demo account has expired
  if (isAuthenticated && user) {
    const demoExpired = await checkDemoExpiry(user.id);
    if (demoExpired) {
      // Sign out and redirect to login
      clearTokens();
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('selectedCurrency');
      onboardingVerified = false;
      queryClient.clear();
      next({ name: 'login' });
      return;
    }
  }

  // Route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: hasSeenOnboarding() ? 'login' : 'welcome' });
    return;
  }

  // Redirect to welcome onboarding before login on first visit
  if (to.name === 'login' && !isAuthenticated && !hasSeenOnboarding()) {
    next({ name: 'welcome' });
    return;
  }

  // Route is for guests only (login page)
  if (to.meta.guestOnly && isAuthenticated) {
    const onboardingComplete = await checkOnboardingStatus(user!.id);

    // If authenticated but not onboarded, go to first account creation
    if (!onboardingComplete) {
      next({ name: 'first-account' });
    } else {
      next({ name: 'dashboard' });
    }
    return;
  }

  // Route requires completed onboarding
  if (to.meta.requiresOnboarding && isAuthenticated) {
    const onboardingComplete = await checkOnboardingStatus(user!.id);

    if (!onboardingComplete) {
      next({ name: 'first-account' });
      return;
    }
  }

  // If onboarding is complete and trying to access onboarding pages
  if (isAuthenticated && to.path.startsWith('/onboarding')) {
    const onboardingComplete = await checkOnboardingStatus(user!.id);
    if (onboardingComplete) {
      next({ name: 'dashboard' });
      return;
    }
  }

  next();
});

// Navigation direction detection for transitions
router.beforeEach((to, from) => {
  // Skip on initial load
  if (!from.name) {
    transitionName.value = 'fade';
    return;
  }

  // Browser back/forward navigation (swipe gesture) - disable Vue animation
  // to avoid conflict with native browser animation
  // Check both flag and timestamp (within 100ms) to catch async timing issues
  const isRecentPopState = Date.now() - popStateTimestamp < 100;
  if (isPopStateNavigation || isRecentPopState) {
    transitionName.value = 'none';
    isPopStateNavigation = false;
    return;
  }

  // Main bottom nav tabs - use fade for horizontal navigation
  const mainTabs = ['/', '/analytics', '/history', '/profile'];
  const isMainTabNavigation =
    mainTabs.includes(to.path) && mainTabs.includes(from.path);

  if (isMainTabNavigation) {
    transitionName.value = 'fade';
    return;
  }

  // Programmatic navigation - slide forward by default
  transitionName.value = 'slide-forward';
});

// Export function for components to trigger slide-back animation
export function navigateBack() {
  transitionName.value = 'slide-back';
  router.back();
}

// Prefetch pages after router is ready
router.isReady().then(() => {
  prefetchPages();
});
