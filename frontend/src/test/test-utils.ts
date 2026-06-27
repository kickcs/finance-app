import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { defineComponent, h, type Component } from 'vue';
import { i18n } from '@/shared/i18n';
import type { User } from '@/shared/api/composables/useAuth';

const defaultRoute: RouteRecordRaw = {
  path: '/',
  component: { template: '<div />' },
};

export function createTestRouter(routes: RouteRecordRaw[] = [defaultRoute]) {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

interface RenderOptions extends ComponentMountingOptions<any> {
  router?: ReturnType<typeof createTestRouter>;
  queryClient?: QueryClient;
  provideAuth?: { user: User };
}

/**
 * Mount a component with Vue Router, TanStack Query, and auth context.
 *
 * Provides the same inject keys as App.vue:
 * - 'user' (Ref<User>)
 * - 'isDemo' (Ref<boolean>)
 * - 'getCategoryById' (stub returning undefined — override via global.provide if needed)
 */
export function renderWithProviders(component: Component, options: RenderOptions = {}) {
  const { router, queryClient, provideAuth, ...mountOptions } = options;

  const testRouter = router ?? createTestRouter();
  const testQueryClient = queryClient ?? createTestQueryClient();

  return mount(component, {
    ...mountOptions,
    global: {
      ...mountOptions.global,
      plugins: [
        ...(mountOptions.global?.plugins ?? []),
        i18n,
        testRouter,
        [VueQueryPlugin, { queryClient: testQueryClient }],
      ],
      provide: {
        // Stub for getCategoryById — override in global.provide if test needs real categories
        getCategoryById: () => undefined,
        ...mountOptions.global?.provide,
        ...(provideAuth
          ? {
              // Matches App.vue: provide('user', user) and provide('isDemo', isDemo)
              user: { value: provideAuth.user },
              isDemo: { value: provideAuth.user.isDemo ?? false },
            }
          : {}),
      },
    },
  });
}

/**
 * Mount a composable in a minimal component context with Vue Query + Router.
 * Returns `{ result, wrapper }`. Caller must unmount wrapper in afterEach.
 */
export function mountComposable<T>(
  composableFn: () => T,
  options: RenderOptions = {},
): { result: T; wrapper: ReturnType<typeof renderWithProviders> } {
  let result!: T;
  const Stub = defineComponent({
    setup() {
      result = composableFn();
      return () => h('div');
    },
  });
  const wrapper = renderWithProviders(Stub, options);
  return { result, wrapper };
}

/** Reusable mock user for tests */
export const mockUser: User = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  currency: 'UZS',
  hasCompletedOnboarding: true,
  defaultAccountId: 'acc-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  isDemo: false,
  demoExpiresAt: null,
};
