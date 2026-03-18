import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import ProfilePage from './ProfilePage.vue';
import { CURRENT_VERSION } from '@/features/changelog/model/changelogData';

// vi.hoisted runs before vi.mock hoisting — safe to define mock refs here
const {
  navigateBackMock,
  mockSignOut,
  mockCheckForUpdate,
  mockShowInstallModal,
  mockOpenInstallModal,
} = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockCheckForUpdate: vi.fn().mockResolvedValue(false),
  mockShowInstallModal: { value: false },
  mockOpenInstallModal: vi.fn(),
}));

// Mock app router
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// Mock useAuth — singleton composable that manages JWT tokens
vi.mock('@/shared/api/composables/useAuth', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    user: { value: mockUser },
    isLoading: { value: false },
    isInitialized: { value: true },
    isAuthenticated: { value: true },
    isAnonymous: { value: false },
    error: { value: null },
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInAnonymously: vi.fn(),
    refreshUser: vi.fn(),
    initialize: vi.fn(),
  }),
  initializeAuth: vi.fn(),
  getCurrentUser: () => mockUser,
  waitForAuth: vi.fn().mockResolvedValue(mockUser),
}));

// Mock usePwaUpdate — depends on virtual:pwa-register/vue which is not available in tests
vi.mock('@/shared/lib/composables/usePwaUpdate', () => ({
  usePwaUpdate: () => ({
    needRefresh: { value: false },
    updateServiceWorker: vi.fn(),
    checkForUpdate: mockCheckForUpdate,
  }),
  usePwaUpdateToast: vi.fn(),
}));

// Mock usePwaInstall — module-level useMediaQuery/useEventListener at import time
vi.mock('@/features/install-pwa', () => ({
  InstallPwaModal: {
    name: 'InstallPwaModal',
    template: '<div data-testid="install-pwa-modal" />',
    props: ['modelValue'],
  },
  usePwaInstall: () => ({
    platform: 'desktop',
    isStandalone: false,
    isDismissed: { value: false },
    showModal: mockShowInstallModal,
    showBanner: { value: false },
    canUseNativePrompt: { value: false },
    openModal: mockOpenInstallModal,
    closeModal: vi.fn(),
    dismissBanner: vi.fn(),
    triggerNativeInstall: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------

const routes = [
  { path: '/profile', component: ProfilePage, name: 'profile' },
  { path: '/', component: { template: '<div />' }, name: 'dashboard' },
  { path: '/login', component: { template: '<div />' }, name: 'login' },
  { path: '/changelog', component: { template: '<div />' }, name: 'changelog' },
  { path: '/settings/currency', component: { template: '<div />' }, name: 'settings-currency' },
  { path: '/settings/import', component: { template: '<div />' }, name: 'settings-import' },
  {
    path: '/settings/categories',
    component: { template: '<div />' },
    name: 'settings-categories',
  },
  { path: '/people', component: { template: '<div />' }, name: 'people-list' },
  {
    path: '/settings/quick-actions',
    component: { template: '<div />' },
    name: 'settings-quick-actions',
  },
  { path: '/settings/color', component: { template: '<div />' }, name: 'settings-color' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(options?: { router?: ReturnType<typeof createTestRouter> }) {
  const router = options?.router ?? createTestRouter(routes);
  if (!options?.router) {
    router.push('/profile');
    await router.isReady();
  }

  currentWrapper = renderWithProviders(ProfilePage, {
    router,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

/** Helper: find element inside teleported modal content via document.body */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

// ===========================================================================
describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title "Профиль"', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Профиль');
    });

    it('displays user name from profile', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="user-name"]').text()).toBe('Test User');
    });

    it('displays user email', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="user-email"]').text()).toBe('test@example.com');
    });

    it('shows fallback name when profile has no name', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            id: 'test-user-1',
            name: null,
            email: 'test@example.com',
            currency: 'UZS',
            hasCompletedOnboarding: true,
            defaultAccountId: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            isDemo: false,
            demoExpiresAt: null,
            dashboardSettings: null,
            quickActionsHidden: false,
            quickActionsHintDismissed: false,
          }),
        ),
      );
      const wrapper = await renderPage();
      // Falls back to user.name from mockUser
      expect(wrapper.find('[data-testid="user-name"]').text()).toBe('Test User');
    });

    it('renders user card', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="user-card"]').exists()).toBe(true);
    });

    it('renders edit profile button', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="edit-profile-btn"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Settings Group
  // -----------------------------------------------------------------------
  describe('settings group', () => {
    it('displays "Настройки" section header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Настройки');
    });

    it('shows currency menu item with code', async () => {
      const wrapper = await renderPage();
      const currencyItem = wrapper.find('[data-testid="menu-item-currency"]');
      expect(currencyItem.exists()).toBe(true);
      expect(currencyItem.text()).toContain('Главная валюта');
      expect(currencyItem.text()).toContain('UZS');
    });

    it('shows color menu item with color dot', async () => {
      const wrapper = await renderPage();
      const colorItem = wrapper.find('[data-testid="menu-item-color"]');
      expect(colorItem.exists()).toBe(true);
      expect(colorItem.text()).toContain('Основной цвет');
      expect(wrapper.find('[data-testid="color-dot"]').exists()).toBe(true);
    });

    it('shows categories menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-categories"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Категории');
    });

    it('shows people menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-people"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Люди');
    });

    it('shows quick-actions menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-quick-actions"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Быстрые действия');
    });
  });

  // -----------------------------------------------------------------------
  // Data Group
  // -----------------------------------------------------------------------
  describe('data group', () => {
    it('displays "Данные" section header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Данные');
    });

    it('shows import menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-import"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Импорт данных');
    });
  });

  // -----------------------------------------------------------------------
  // App Group
  // -----------------------------------------------------------------------
  describe('app group', () => {
    it('displays "Приложение" section header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Приложение');
    });

    it('shows "Что нового" menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-whats-new"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Что нового');
    });

    it('shows unseen changes badge when changelog has unseen changes', async () => {
      // Do not set lastSeenChangelogVersion — so hasUnseenChanges is true
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="unseen-badge"]').exists()).toBe(true);
    });

    it('hides unseen changes badge when changelog is seen', async () => {
      // Set last seen version to current so there are no unseen changes
      localStorage.setItem('lastSeenChangelogVersion', CURRENT_VERSION);
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="unseen-badge"]').exists()).toBe(false);
    });

    it('shows update menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-update"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('Обновление');
    });

    it('shows "О приложении" menu item', async () => {
      const wrapper = await renderPage();
      const item = wrapper.find('[data-testid="menu-item-about"]');
      expect(item.exists()).toBe(true);
      expect(item.text()).toContain('О приложении');
    });
  });

  // -----------------------------------------------------------------------
  // Subscription Section
  // -----------------------------------------------------------------------
  describe('subscription section', () => {
    it('renders subscription section with "Подписка" header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Подписка');
    });

    it('shows free plan status by default', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Бесплатный');
    });
  });

  // -----------------------------------------------------------------------
  // Menu Navigation
  // -----------------------------------------------------------------------
  describe('menu navigation', () => {
    it('clicking currency navigates to settings-currency', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-currency"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings-currency' });
    });

    it('clicking color navigates to settings-color', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-color"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings-color' });
    });

    it('clicking categories navigates to settings-categories', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-categories"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings-categories' });
    });

    it('clicking people navigates to people-list', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-people"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'people-list' });
    });

    it('clicking quick-actions navigates to settings-quick-actions', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-quick-actions"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings-quick-actions' });
    });

    it('clicking import navigates to settings-import', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-import"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'settings-import' });
    });

    it('clicking "Что нового" navigates to changelog', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      await wrapper.find('[data-testid="menu-item-whats-new"]').trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'changelog' });
    });

    it('clicking "О приложении" opens install modal', async () => {
      const wrapper = await renderPage();
      await wrapper.find('[data-testid="menu-item-about"]').trigger('click');

      expect(mockOpenInstallModal).toHaveBeenCalled();
    });

    it('clicking "Обновление" triggers update check', async () => {
      const wrapper = await renderPage();
      await wrapper.find('[data-testid="menu-item-update"]').trigger('click');
      await flushPromises();

      expect(mockCheckForUpdate).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edit Profile
  // -----------------------------------------------------------------------
  describe('edit profile', () => {
    it('clicking edit button opens edit profile modal', async () => {
      const wrapper = await renderPage();
      await wrapper.find('[data-testid="edit-profile-btn"]').trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'EditProfileModal' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Logout Flow
  // -----------------------------------------------------------------------
  describe('logout flow', () => {
    it('shows logout button', async () => {
      const wrapper = await renderPage();
      const logoutBtn = wrapper.find('[data-testid="logout-btn"]');
      expect(logoutBtn.exists()).toBe(true);
      expect(logoutBtn.text()).toContain('Выйти из аккаунта');
    });

    it('clicking logout button shows confirmation modal', async () => {
      const wrapper = await renderPage();
      await wrapper.find('[data-testid="logout-btn"]').trigger('click');
      await flushPromises();

      // Modal content is rendered in a portal (document.body)
      const dialog = findInBody('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.textContent).toContain('Вы уверены, что хотите выйти из аккаунта?');
    });

    it('confirming logout calls signOut and redirects to login', async () => {
      const router = createTestRouter(routes);
      router.push('/profile');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });

      // Open the modal
      await wrapper.find('[data-testid="logout-btn"]').trigger('click');
      await flushPromises();

      // Confirm logout — button is in the portal
      const confirmBtn = findInBody('[data-testid="logout-confirm-btn"]');
      expect(confirmBtn).not.toBeNull();
      confirmBtn!.click();
      await flushPromises();

      expect(mockSignOut).toHaveBeenCalled();
      expect(pushSpy).toHaveBeenCalledWith({ name: 'login' });
    });

    it('cancelling logout closes modal without calling signOut', async () => {
      const wrapper = await renderPage();

      // Open the modal
      await wrapper.find('[data-testid="logout-btn"]').trigger('click');
      await flushPromises();

      // Modal should be visible
      const dialog = findInBody('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.textContent).toContain('Вы уверены, что хотите выйти из аккаунта?');

      // Cancel — button is in the portal
      const cancelBtn = findInBody('[data-testid="logout-cancel-btn"]');
      expect(cancelBtn).not.toBeNull();
      cancelBtn!.click();
      await flushPromises();

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Changelog mark as seen
  // -----------------------------------------------------------------------
  describe('changelog interactions', () => {
    it('clicking "Что нового" marks changelog as seen', async () => {
      // Unseen badge should be visible before clicking
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="unseen-badge"]').exists()).toBe(true);

      await wrapper.find('[data-testid="menu-item-whats-new"]').trigger('click');
      await flushPromises();

      // After clicking, the localStorage should be updated with current version
      expect(localStorage.getItem('lastSeenChangelogVersion')).toBe(CURRENT_VERSION);
    });
  });
});
