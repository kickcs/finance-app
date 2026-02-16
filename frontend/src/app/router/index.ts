import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { waitForAuth } from '@/shared/api/composables/useAuth';
import type { User } from '@/shared/api/composables/useAuth';
import { clearTokens } from '@/shared/api/http';
import { queryClient } from '@/shared/api/queryClient';

// Navigation direction state for page transitions
export const transitionName = ref<
  'slide-forward' | 'slide-back' | 'fade' | 'none'
>('fade');

// Prefetch all page components for instant navigation
const prefetchPages = () => {
  const prefetch = () => {
    // Main navigation pages
    import('@/pages/history/HistoryPage.vue');
    import('@/pages/analytics/AnalyticsPage.vue');
    import('@/pages/profile/ProfilePage.vue');
    import('@/pages/transactions/new/AddTransactionPage.vue');
    // Analytics
    import('@/pages/analytics/AnalyticsFullPage.vue');
    // Accounts
    import('@/pages/accounts/AccountsPage.vue');
    import('@/pages/accounts/AccountDetailPage.vue');
    // Debts
    import('@/pages/debts/list/DebtsListPage.vue');
    import('@/pages/debts/detail/DebtDetailPage.vue');
    import('@/pages/debts/new/AddDebtPage.vue');
    // Reminders
    import('@/pages/reminders/list/RemindersListPage.vue');
    import('@/pages/reminders/detail/ReminderDetailPage.vue');
    import('@/pages/reminders/new/AddReminderPage.vue');
    // Settings & misc
    import('@/pages/changelog/ChangelogPage.vue');
    import('@/pages/settings/currency/CurrencySettingsPage.vue');
    import('@/pages/settings/categories/CategoriesPage.vue');
    import('@/pages/settings/import/ImportPage.vue');
  };
  const idle = requestIdleCallback?.(prefetch);
  if (idle === undefined) {
    setTimeout(prefetch, 2000);
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
      component: () => import('@/pages/settings/import/ImportPage.vue'),
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

// In-memory flag to skip repeated onboarding checks after first success
let onboardingVerified = false;

// Reset onboarding verification flag (call on logout/user switch)
export function resetOnboardingVerified() {
  onboardingVerified = false;
}

// Synchronous onboarding check using user object + localStorage (no network)
function checkOnboardingStatusFast(): boolean {
  if (onboardingVerified) return true;

  const localOnboarding = localStorage.getItem('onboardingComplete') === 'true';
  if (localOnboarding) {
    onboardingVerified = true;
  }
  return localOnboarding;
}

function hasSeenOnboarding(): boolean {
  return localStorage.getItem('hasSeenOnboarding') === 'true';
}

// Synchronous demo expiry check using user object + localStorage (no network)
function checkDemoExpiryFast(user: User): boolean {
  if (!user.isDemo) return false;

  const expiresAt =
    user.demoExpiresAt || localStorage.getItem('demoExpiresAt');
  if (!expiresAt) return false;

  return new Date(expiresAt) < new Date();
}

// Navigation guard for auth and onboarding
router.beforeEach(async (to, from, next) => {
  // Wait for auth to initialize (optimistic — returns instantly if JWT is valid)
  const user = await waitForAuth();
  const isAuthenticated = !!user;

  // Check if demo account has expired (sync — uses JWT + localStorage)
  if (isAuthenticated && user) {
    if (checkDemoExpiryFast(user)) {
      clearTokens();
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('selectedCurrency');
      localStorage.removeItem('demoExpiresAt');
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
    if (!checkOnboardingStatusFast()) {
      next({ name: 'first-account' });
    } else {
      next({ name: 'dashboard' });
    }
    return;
  }

  // Route requires completed onboarding
  if (to.meta.requiresOnboarding && isAuthenticated) {
    if (!checkOnboardingStatusFast()) {
      next({ name: 'first-account' });
      return;
    }
  }

  // If onboarding is complete and trying to access onboarding pages
  if (isAuthenticated && to.path.startsWith('/onboarding')) {
    if (checkOnboardingStatusFast()) {
      next({ name: 'dashboard' });
      return;
    }
  }

  // Prefetch dashboard data while page chunk downloads
  if (to.name === 'dashboard' && isAuthenticated && user) {
    import('./dashboardPrefetch').then(({ prefetchDashboardData }) => {
      prefetchDashboardData(user.id);
    });
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
