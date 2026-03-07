import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { waitForAuth } from '@/shared/api/composables/useAuth';
import type { User } from '@/shared/api/composables/useAuth';
import { clearTokens } from '@/shared/api/http';
import { queryClient } from '@/shared/api/queryClient';
import { MAIN_NAV_ITEMS } from '@/shared/config/navigation';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { ROUTE_NAMES } from './routeNames';

// Navigation direction state for page transitions
export const transitionName = ref<
  'slide-forward' | 'slide-back' | 'slide-tab-forward' | 'slide-tab-backward' | 'fade' | 'none'
>('fade');

// Prefetch all page components for instant navigation
const prefetchPages = () => {
  const prefetch = () => {
    // Main navigation pages
    import('@/pages/history/HistoryPage.vue');
    import('@/pages/analytics/AnalyticsPage.vue');
    import('@/pages/profile/ProfilePage.vue');
    import('@/pages/transactions/new/AddTransactionPage.vue');
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
    // Main App Layout - wrap all internal pages
    {
      path: '/',
      component: () => import('@/app/layouts').then((m) => m.MainLayout),
      meta: { requiresAuth: true, requiresOnboarding: true },
      children: [
        {
          path: '',
          name: ROUTE_NAMES.DASHBOARD,
          component: () => import('@/pages/dashboard/DashboardPage.vue'),
        },
        {
          path: 'history',
          name: ROUTE_NAMES.HISTORY,
          component: () => import('@/pages/history/HistoryPage.vue'),
        },
        {
          path: 'analytics',
          name: ROUTE_NAMES.ANALYTICS,
          component: () => import('@/pages/analytics/AnalyticsPage.vue'),
        },
        {
          path: 'accounts',
          name: ROUTE_NAMES.ACCOUNTS,
          component: () => import('@/pages/accounts/AccountsPage.vue'),
        },
        {
          path: 'accounts/new',
          name: ROUTE_NAMES.NEW_ACCOUNT,
          component: () => import('@/pages/onboarding/first-account/FirstAccountPage.vue'),
        },
        {
          path: 'accounts/:id',
          name: ROUTE_NAMES.ACCOUNT_DETAIL,
          component: () => import('@/pages/accounts/AccountDetailPage.vue'),
        },
        {
          path: 'transactions/new',
          name: ROUTE_NAMES.NEW_TRANSACTION,
          component: () => import('@/pages/transactions/new/AddTransactionPage.vue'),
        },
        {
          path: 'reminders/new',
          name: ROUTE_NAMES.NEW_REMINDER,
          component: () => import('@/pages/reminders/new/AddReminderPage.vue'),
        },
        {
          path: 'reminders/:id',
          name: ROUTE_NAMES.REMINDER_DETAIL,
          component: () => import('@/pages/reminders/detail/ReminderDetailPage.vue'),
        },
        {
          path: 'reminders',
          name: ROUTE_NAMES.REMINDERS_LIST,
          component: () => import('@/pages/reminders/list/RemindersListPage.vue'),
        },
        {
          path: 'debts',
          name: ROUTE_NAMES.DEBTS_LIST,
          component: () => import('@/pages/debts/list/DebtsListPage.vue'),
        },
        {
          path: 'debts/new',
          name: ROUTE_NAMES.NEW_DEBT,
          component: () => import('@/pages/debts/new/AddDebtPage.vue'),
        },
        {
          path: 'debts/:id',
          name: ROUTE_NAMES.DEBT_DETAIL,
          component: () => import('@/pages/debts/detail/DebtDetailPage.vue'),
        },
        {
          path: 'profile',
          name: ROUTE_NAMES.PROFILE,
          component: () => import('@/pages/profile/ProfilePage.vue'),
        },
        {
          path: 'changelog',
          name: ROUTE_NAMES.CHANGELOG,
          component: () => import('@/pages/changelog/ChangelogPage.vue'),
        },
        {
          path: 'settings/currency',
          name: ROUTE_NAMES.SETTINGS_CURRENCY,
          component: () => import('@/pages/settings/currency/CurrencySettingsPage.vue'),
        },
        {
          path: 'settings/import',
          name: ROUTE_NAMES.SETTINGS_IMPORT,
          component: () => import('@/pages/settings/import/ImportPage.vue'),
        },
        {
          path: 'settings/categories',
          name: ROUTE_NAMES.SETTINGS_CATEGORIES,
          component: () => import('@/pages/settings/categories/CategoriesPage.vue'),
        },
        {
          path: 'people',
          name: ROUTE_NAMES.PEOPLE_LIST,
          component: () => import('@/pages/people/PeopleListPage.vue'),
        },
        {
          path: 'settings/quick-actions',
          name: ROUTE_NAMES.SETTINGS_QUICK_ACTIONS,
          component: () => import('@/pages/settings/quick-actions/QuickActionsSettingsPage.vue'),
        },
        {
          path: 'scan-receipt',
          name: ROUTE_NAMES.SCAN_RECEIPT,
          component: () => import('@/pages/scan-receipt/ScanReceiptPage.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'dashboard/settings',
          name: ROUTE_NAMES.DASHBOARD_SETTINGS,
          component: () => import('@/pages/dashboard-settings/DashboardSettingsPage.vue'),
        },
      ],
    },
    // Welcome onboarding (pre-auth)
    {
      path: '/welcome',
      name: ROUTE_NAMES.WELCOME,
      component: () => import('@/pages/onboarding/welcome/WelcomePage.vue'),
      meta: { guestOnly: true },
    },
    // Auth routes
    {
      path: '/auth/login',
      name: ROUTE_NAMES.LOGIN,
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/auth/callback',
      name: ROUTE_NAMES.AUTH_CALLBACK,
      component: () => import('@/pages/auth/AuthCallbackPage.vue'),
    },
    // Onboarding - only first account creation (currency is selected per-account now)
    {
      path: '/onboarding/first-account',
      name: ROUTE_NAMES.FIRST_ACCOUNT,
      component: () => import('@/pages/onboarding/first-account/FirstAccountPage.vue'),
      meta: { requiresAuth: true },
    },
    // Legacy redirect for old currency selection route
    {
      path: '/onboarding/currency',
      redirect: '/onboarding/first-account',
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

// Synchronous onboarding check using verified user data with localStorage as optimistic cache
function checkOnboardingStatusFast(user?: User | null): boolean {
  if (onboardingVerified) return true;

  // Prefer verified server data when available
  if (user?.hasCompletedOnboarding) {
    onboardingVerified = true;
    return true;
  }

  // Fall back to localStorage only as optimistic UX cache (server will re-verify)
  // Do NOT set onboardingVerified here — localStorage can be stale
  return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
}

function hasSeenOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING) === 'true';
}

// Synchronous demo expiry check using verified user data only
function checkDemoExpiryFast(user: User): boolean {
  if (!user.isDemo) return false;

  const expiresAt = user.demoExpiresAt;
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
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_CURRENCY);
      localStorage.removeItem(STORAGE_KEYS.DEMO_EXPIRES_AT);
      onboardingVerified = false;
      queryClient.clear();
      next({ name: ROUTE_NAMES.LOGIN });
      return;
    }
  }

  // Route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: hasSeenOnboarding() ? ROUTE_NAMES.LOGIN : ROUTE_NAMES.WELCOME });
    return;
  }

  // Redirect to welcome onboarding before login on first visit
  if (to.name === ROUTE_NAMES.LOGIN && !isAuthenticated && !hasSeenOnboarding()) {
    next({ name: ROUTE_NAMES.WELCOME });
    return;
  }

  // Route is for guests only (login page)
  if (to.meta.guestOnly && isAuthenticated) {
    if (!checkOnboardingStatusFast(user)) {
      next({ name: ROUTE_NAMES.FIRST_ACCOUNT });
    } else {
      next({ name: ROUTE_NAMES.DASHBOARD });
    }
    return;
  }

  // Route requires completed onboarding
  if (to.meta.requiresOnboarding && isAuthenticated) {
    if (!checkOnboardingStatusFast(user)) {
      next({ name: ROUTE_NAMES.FIRST_ACCOUNT });
      return;
    }
  }

  // If onboarding is complete and trying to access onboarding pages
  if (isAuthenticated && to.path.startsWith('/onboarding')) {
    if (checkOnboardingStatusFast(user)) {
      next({ name: ROUTE_NAMES.DASHBOARD });
      return;
    }
  }

  // Prefetch dashboard data while page chunk downloads
  if (to.name === ROUTE_NAMES.DASHBOARD && isAuthenticated && user) {
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

  // Main bottom nav tabs - directional slide-fade based on tab index
  const mainTabs = MAIN_NAV_ITEMS.map((item) => item.path);
  const fromTabIndex = mainTabs.indexOf(from.path);
  const toTabIndex = mainTabs.indexOf(to.path);

  if (fromTabIndex !== -1 && toTabIndex !== -1) {
    transitionName.value = toTabIndex > fromTabIndex ? 'slide-tab-forward' : 'slide-tab-backward';
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
