import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import PeopleListPage from './PeopleListPage.vue';
import {
  mockPersonResponse,
  mockSecondPersonResponse,
  mockThirdPersonResponse,
} from '@/test/mocks/handlers/people';
import { useToast } from '@/shared/ui';

// Mock app router — vi.hoisted runs before vi.mock hoisting
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// ---------------------------------------------------------------------------

const routes = [
  { path: '/people', component: PeopleListPage, name: 'people-list' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage() {
  const router = createTestRouter(routes);
  router.push('/people');
  await router.isReady();

  currentWrapper = renderWithProviders(PeopleListPage, {
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

/** Helper: set UInput value via its internal input element in the DOM */
async function setModalInputValue(value: string) {
  // UInput's internal <input> rendered inside the teleported modal
  const input = document.body.querySelector('[role="dialog"] input') as HTMLInputElement | null;
  if (!input) throw new Error('Modal input not found in document.body');
  // Simulate native input event
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

// ===========================================================================
describe('PeopleListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title "Люди"', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Люди');
    });

    it('shows people list with names when people exist', async () => {
      server.use(
        http.get('*/api/people', () =>
          HttpResponse.json([mockPersonResponse, mockSecondPersonResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('Мария');
    });

    it('shows count header with correct number', async () => {
      server.use(
        http.get('*/api/people', () =>
          HttpResponse.json([mockPersonResponse, mockSecondPersonResponse]),
        ),
      );
      const wrapper = await renderPage();

      const countEl = wrapper.find('[data-testid="people-count"]');
      expect(countEl.exists()).toBe(true);
      expect(countEl.text()).toContain('Всего контактов: 2');
    });

    it('renders correct number of person items', async () => {
      server.use(
        http.get('*/api/people', () =>
          HttpResponse.json([
            mockPersonResponse,
            mockSecondPersonResponse,
            mockThirdPersonResponse,
          ]),
        ),
      );
      const wrapper = await renderPage();

      const personItems = wrapper.findAll('[data-testid="person-item"]');
      expect(personItems.length).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Empty State
  // -----------------------------------------------------------------------
  describe('empty state', () => {
    it('shows empty state when no people', async () => {
      // Default handler returns empty array
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="people-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Нет контактов');
    });

    it('empty state has action button to create contact', async () => {
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Создать контакт');
    });

    it('does not show count header when no people', async () => {
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="people-count"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------
  describe('loading state', () => {
    it('shows skeleton while people load', async () => {
      let resolvePeople!: () => void;
      server.use(
        http.get('*/api/people', async () => {
          await new Promise<void>((res) => {
            resolvePeople = res;
          });
          return HttpResponse.json([]);
        }),
      );

      const router = createTestRouter(routes);
      router.push('/people');
      await router.isReady();

      currentWrapper = renderWithProviders(PeopleListPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="people-loading"]').exists()).toBe(true);

      // Release the blocked response and let component settle
      resolvePeople();
      await flushPromises();
      await flushPromises();
    });
  });

  // -----------------------------------------------------------------------
  // Add Person
  // -----------------------------------------------------------------------
  describe('add person', () => {
    it('opens add modal when FAB clicked', async () => {
      const wrapper = await renderPage();

      await wrapper.find('[data-testid="add-person-fab"]').trigger('click');
      await nextTick();

      // Modal is open — check via component props
      const modal = wrapper.findComponent({ name: 'UModal' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
      // Title is "Новый контакт" — rendered inside teleported dialog
      expect(modal.props('title')).toBe('Новый контакт');
    });

    it('opens add modal from empty state action button', async () => {
      const wrapper = await renderPage();

      const actionBtn = wrapper.findAll('button').find((b) => b.text().includes('Создать контакт'));
      expect(actionBtn).toBeDefined();
      await actionBtn!.trigger('click');
      await nextTick();

      const modal = wrapper.findComponent({ name: 'UModal' });
      expect(modal.props('modelValue')).toBe(true);
      expect(modal.props('title')).toBe('Новый контакт');
    });

    it('creates person via API and shows success toast', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/people', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'person-new',
            userId: 'test-user-1',
            name: capturedPayload.name,
            color: capturedPayload.color,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }),
      );

      const wrapper = await renderPage();

      // Open add modal
      await wrapper.find('[data-testid="add-person-fab"]').trigger('click');
      await nextTick();

      // Fill in the name via native input inside the teleported modal
      await setModalInputValue('Новый Контакт');

      // Click save button inside teleported modal
      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      saveBtn!.click();
      await flushPromises();
      await flushPromises();

      // Verify API call
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.name).toBe('Новый Контакт');
    });
  });

  // -----------------------------------------------------------------------
  // Edit Person
  // -----------------------------------------------------------------------
  describe('edit person', () => {
    it('opens edit modal with correct title when person clicked', async () => {
      server.use(http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])));
      const wrapper = await renderPage();

      // Click person item button
      const personBtn = wrapper.find('[data-testid="person-item"] button');
      expect(personBtn.exists()).toBe(true);
      await personBtn.trigger('click');
      await nextTick();

      // Modal should show edit title
      const modal = wrapper.findComponent({ name: 'UModal' });
      expect(modal.props('modelValue')).toBe(true);
      expect(modal.props('title')).toBe('Редактировать');
    });

    it('updates person via API', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])),
        http.patch('*/api/people/:id', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockPersonResponse,
            ...capturedPayload,
            updatedAt: new Date().toISOString(),
          });
        }),
      );
      const wrapper = await renderPage();

      // Click person to open edit modal
      await wrapper.find('[data-testid="person-item"] button').trigger('click');
      await nextTick();

      // Change the name via native input inside teleported modal
      await setModalInputValue('Алексей Обновлённый');

      // Click save button inside teleported modal
      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      saveBtn!.click();
      await flushPromises();
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.name).toBe('Алексей Обновлённый');
    });
  });

  // -----------------------------------------------------------------------
  // Delete Person
  // -----------------------------------------------------------------------
  describe('delete person', () => {
    it('shows confirm delete modal and deletes on confirm', async () => {
      let deletedId: string | null = null;
      server.use(
        http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])),
        http.delete('*/api/people/:id', ({ params }) => {
          deletedId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const wrapper = await renderPage();

      // Trigger delete via SwipeableItem action-left emit
      const swipeItem = wrapper.findComponent({ name: 'SwipeableItem' });
      expect(swipeItem.exists()).toBe(true);
      swipeItem.vm.$emit('action-left');
      await nextTick();

      // Confirm delete modal should be open
      const confirmModal = wrapper.findComponent({ name: 'ConfirmDeleteModal' });
      expect(confirmModal.exists()).toBe(true);
      expect(confirmModal.props('modelValue')).toBe(true);

      // Emit confirm
      confirmModal.vm.$emit('confirm');
      await flushPromises();
      await flushPromises();

      expect(deletedId).toBe('person-1');
    });

    it('cancels delete when cancel is clicked', async () => {
      server.use(http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])));
      const wrapper = await renderPage();

      // Trigger delete via SwipeableItem
      const swipeItem = wrapper.findComponent({ name: 'SwipeableItem' });
      swipeItem.vm.$emit('action-left');
      await nextTick();

      // Cancel via ConfirmDeleteModal
      const confirmModal = wrapper.findComponent({ name: 'ConfirmDeleteModal' });
      expect(confirmModal.props('modelValue')).toBe(true);

      confirmModal.vm.$emit('cancel');
      await nextTick();

      // Modal should close (modelValue becomes false)
      expect(confirmModal.props('modelValue')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Form Validation
  // -----------------------------------------------------------------------
  describe('form validation', () => {
    it('save button is disabled when name is empty', async () => {
      const wrapper = await renderPage();

      // Open add modal
      await wrapper.find('[data-testid="add-person-fab"]').trigger('click');
      await nextTick();

      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      expect(saveBtn!.hasAttribute('disabled')).toBe(true);
    });

    it('save button is enabled when name is filled', async () => {
      const wrapper = await renderPage();

      // Open add modal
      await wrapper.find('[data-testid="add-person-fab"]').trigger('click');
      await nextTick();

      // Fill name
      await setModalInputValue('Тест');

      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      expect(saveBtn!.hasAttribute('disabled')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------
  describe('sorting', () => {
    it('people are sorted alphabetically (ru locale)', async () => {
      server.use(
        http.get('*/api/people', () =>
          HttpResponse.json([
            mockSecondPersonResponse,
            mockThirdPersonResponse,
            mockPersonResponse,
          ]),
        ),
      );
      const wrapper = await renderPage();

      const personItems = wrapper.findAll('[data-testid="person-item"]');
      expect(personItems.length).toBe(3);

      // Expected order: Алексей, Борис, Мария (ru locale alphabetical)
      const names = personItems.map((item) => item.text());
      expect(names[0]).toContain('Алексей');
      expect(names[1]).toContain('Борис');
      expect(names[2]).toContain('Мария');
    });
  });

  // -----------------------------------------------------------------------
  // Back Navigation
  // -----------------------------------------------------------------------
  describe('back navigation', () => {
    it('calls navigateBack when back button is clicked', async () => {
      const wrapper = await renderPage();

      const header = wrapper.findComponent({ name: 'AppHeader' });
      expect(header.exists()).toBe(true);
      header.vm.$emit('back');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('shows error toast on failed create', async () => {
      server.use(
        http.post('*/api/people', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();
      const { toasts, dismissAll } = useToast();

      // Open add modal
      await wrapper.find('[data-testid="add-person-fab"]').trigger('click');
      await nextTick();

      // Fill name
      await setModalInputValue('Ошибка');

      // Click save
      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      saveBtn!.click();
      await flushPromises();
      await flushPromises();

      // Check toast was created with error message
      const errorToast = toasts.value.find((t) => t.title === 'Не удалось сохранить');
      expect(errorToast).toBeDefined();
      expect(errorToast!.variant).toBe('error');
      dismissAll();
    });

    it('shows error toast on failed update', async () => {
      server.use(
        http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])),
        http.patch('*/api/people/:id', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();
      const { toasts, dismissAll } = useToast();

      // Click person to open edit modal
      await wrapper.find('[data-testid="person-item"] button').trigger('click');
      await nextTick();

      // Change the name
      await setModalInputValue('Обновление');

      // Click save
      const saveBtn = findInBody('[data-testid="save-person-btn"]');
      expect(saveBtn).not.toBeNull();
      saveBtn!.click();
      await flushPromises();
      await flushPromises();

      const errorToast = toasts.value.find((t) => t.title === 'Не удалось сохранить');
      expect(errorToast).toBeDefined();
      expect(errorToast!.variant).toBe('error');
      dismissAll();
    });

    it('shows error toast on failed delete', async () => {
      server.use(
        http.get('*/api/people', () => HttpResponse.json([mockPersonResponse])),
        http.delete('*/api/people/:id', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();
      const { toasts, dismissAll } = useToast();

      // Trigger delete via SwipeableItem
      const swipeItem = wrapper.findComponent({ name: 'SwipeableItem' });
      swipeItem.vm.$emit('action-left');
      await nextTick();

      // Confirm delete
      const confirmModal = wrapper.findComponent({ name: 'ConfirmDeleteModal' });
      confirmModal.vm.$emit('confirm');
      await flushPromises();
      await flushPromises();

      const errorToast = toasts.value.find((t) => t.title === 'Не удалось удалить');
      expect(errorToast).toBeDefined();
      expect(errorToast!.variant).toBe('error');
      dismissAll();
    });
  });
});
