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
import {
  mockGivenDebtResponse,
  mockTakenDebtResponse,
  mockClosedDebtResponse,
} from '@/test/mocks/handlers/debts';

// Mock app router — vi.hoisted runs before vi.mock hoisting
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// Закрытие настоящей шторки роняет jsdom на чтении style отсоединённого узла —
// см. комментарий в стабе.
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const routes = [
  { path: '/people', component: PeopleListPage, name: 'people-list' },
  { path: '/debts', component: { template: '<div />' }, name: 'debts' },
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

/** Find element inside teleported sheet content */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

/** Set value on a UInput's internal <input>, in-page or teleported */
async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

/** Type into the page's combined search/add field */
async function typeQuery(wrapper: ReturnType<typeof renderWithProviders>, value: string) {
  const input = wrapper.find('[data-testid="person-search-input"] input')
    .element as HTMLInputElement;
  await setInputValue(input, value);
  await flushPromises();
}

/** Open the edit sheet by clicking a person row */
async function openEditSheet(wrapper: ReturnType<typeof renderWithProviders>, index = 0) {
  const rows = wrapper.findAll('[data-testid="person-item"] button');
  await rows[index].trigger('click');
  await flushPromises();
  await nextTick();
}

function withPeople(...people: object[]) {
  server.use(http.get('*/api/people', () => HttpResponse.json(people)));
}

function withDebts(...debts: object[]) {
  server.use(http.get('*/api/debts', () => HttpResponse.json(debts)));
}

// ---------------------------------------------------------------------------

describe('PeopleListPage', () => {
  beforeEach(() => {
    navigateBackMock.mockClear();
  });

  afterEach(async () => {
    currentWrapper?.unmount();
    currentWrapper = null;
    // Шторка снимается через watcher presence в reka-ui: он читает style уже
    // отмонтированного узла. Даём ему отработать до того, как чистим body,
    // иначе jsdom роняет unhandled rejection на разрушенном CSSStyleDeclaration.
    await flushPromises();
    document.body.innerHTML = '';
  });

  describe('rendering', () => {
    it('displays page title "Люди"', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Люди');
    });

    it('shows people list with names when people exist', async () => {
      withPeople(mockPersonResponse, mockSecondPersonResponse);
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('Мария');
    });

    it('renders correct number of person items', async () => {
      withPeople(mockPersonResponse, mockSecondPersonResponse, mockThirdPersonResponse);
      const wrapper = await renderPage();

      expect(wrapper.findAll('[data-testid="person-item"]')).toHaveLength(3);
    });

    it('shows contact count in the summary line', async () => {
      withPeople(mockPersonResponse, mockSecondPersonResponse);
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="people-count"]').text()).toContain('2 контакта');
    });

    it('does not show summary line when there are no people', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="people-count"]').exists()).toBe(false);
    });

    it('sorts people alphabetically (ru locale)', async () => {
      // Приходят в порядке Алексей, Мария, Борис — ожидаем Алексей, Борис, Мария
      withPeople(mockPersonResponse, mockSecondPersonResponse, mockThirdPersonResponse);
      const wrapper = await renderPage();

      const names = wrapper.findAll('[data-testid="person-item"]').map((n) => n.text());
      expect(names[0]).toContain('Алексей');
      expect(names[1]).toContain('Борис');
      expect(names[2]).toContain('Мария');
    });
  });

  describe('debt net', () => {
    it('shows what a person owes you', async () => {
      withPeople(mockPersonResponse);
      withDebts(mockGivenDebtResponse); // Алексей, given, remaining 30000
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="person-item"]').text()).toContain('должен вам');
    });

    it('folds counter-debts of the same person into one net amount', async () => {
      withPeople(mockPersonResponse);
      withDebts(
        { ...mockGivenDebtResponse, remainingAmount: 30000 },
        { ...mockTakenDebtResponse, id: 'debt-x', personName: 'Алексей', remainingAmount: 50000 },
      );
      const wrapper = await renderPage();

      // 30000 дал − 50000 взял = −20000 → «вы должны»
      const row = wrapper.find('[data-testid="person-item"]');
      expect(row.text()).toContain('вы должны');
      expect(row.text()).not.toContain('должен вам');
    });

    it('ignores closed debts', async () => {
      withPeople(mockPersonResponse);
      withDebts({ ...mockClosedDebtResponse, personName: 'Алексей' });
      const wrapper = await renderPage();

      const row = wrapper.find('[data-testid="person-item"]');
      expect(row.text()).not.toContain('должен вам');
      expect(row.text()).not.toContain('вы должны');
    });

    it('shows no amount for a person without debts', async () => {
      withPeople(mockSecondPersonResponse); // Мария — долгов нет
      withDebts(mockGivenDebtResponse); // долг числится за Алексеем
      const wrapper = await renderPage();

      const row = wrapper.find('[data-testid="person-item"]');
      expect(row.text()).not.toContain('должен вам');
      expect(row.text()).not.toContain('вы должны');
    });
  });

  describe('search', () => {
    it('filters the list by query', async () => {
      withPeople(mockPersonResponse, mockSecondPersonResponse);
      const wrapper = await renderPage();

      await typeQuery(wrapper, 'Мар');

      const items = wrapper.findAll('[data-testid="person-item"]');
      expect(items).toHaveLength(1);
      expect(items[0].text()).toContain('Мария');
    });

    it('shows a no-matches hint when nothing is found', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      await typeQuery(wrapper, 'Зинаида');

      expect(wrapper.find('[data-testid="people-no-matches"]').exists()).toBe(true);
    });
  });

  describe('add person', () => {
    it('offers to create a contact when the typed name is new', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="create-person-btn"]').exists()).toBe(false);

      await typeQuery(wrapper, 'Дмитрий');

      const createBtn = wrapper.find('[data-testid="create-person-btn"]');
      expect(createBtn.exists()).toBe(true);
      expect(createBtn.text()).toContain('Дмитрий');
    });

    it('does not offer to create when the name already exists', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      await typeQuery(wrapper, 'Алексей');

      expect(wrapper.find('[data-testid="create-person-btn"]').exists()).toBe(false);
    });

    it('matches an existing name case-insensitively', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      await typeQuery(wrapper, 'алексей');

      expect(wrapper.find('[data-testid="create-person-btn"]').exists()).toBe(false);
    });

    it('creates the person via API and clears the field', async () => {
      let createdBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/people', async ({ request }) => {
          createdBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'person-new',
            userId: 'test-user-1',
            name: createdBody.name,
            color: createdBody.color,
            createdAt: '2026-07-27T00:00:00.000Z',
            updatedAt: '2026-07-27T00:00:00.000Z',
          });
        }),
      );

      const wrapper = await renderPage();
      await typeQuery(wrapper, 'Дмитрий');
      await wrapper.find('[data-testid="create-person-btn"]').trigger('click');
      await flushPromises();

      expect(createdBody).not.toBeNull();
      expect(createdBody!.name).toBe('Дмитрий');
      expect(wrapper.find('[data-testid="create-person-btn"]').exists()).toBe(false);
    });

    it('assigns a colour derived from the name, so it is stable', async () => {
      const bodies: Record<string, unknown>[] = [];
      server.use(
        http.post('*/api/people', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          bodies.push(body);
          return HttpResponse.json({
            id: `person-${bodies.length}`,
            userId: 'test-user-1',
            name: body.name,
            color: body.color,
            createdAt: '2026-07-27T00:00:00.000Z',
            updatedAt: '2026-07-27T00:00:00.000Z',
          });
        }),
      );

      const first = await renderPage();
      await typeQuery(first, 'Дмитрий');
      await first.find('[data-testid="create-person-btn"]').trigger('click');
      await flushPromises();

      currentWrapper?.unmount();
      currentWrapper = null;

      const second = await renderPage();
      await typeQuery(second, 'Дмитрий');
      await second.find('[data-testid="create-person-btn"]').trigger('click');
      await flushPromises();

      expect(bodies).toHaveLength(2);
      expect(bodies[0].color).toBe(bodies[1].color);
    });
  });

  describe('edit person', () => {
    it('opens the edit sheet with the person name prefilled', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      await openEditSheet(wrapper);

      const sheet = findInBody('[data-testid="person-edit-sheet"]');
      expect(sheet).not.toBeNull();
      expect((sheet!.querySelector('input') as HTMLInputElement).value).toBe('Алексей');
    });

    it('updates the person via API', async () => {
      withPeople(mockPersonResponse);
      let patchBody: Record<string, unknown> | null = null;
      server.use(
        http.patch('*/api/people/:id', async ({ request, params }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockPersonResponse, id: params.id, ...patchBody });
        }),
      );

      const wrapper = await renderPage();
      await openEditSheet(wrapper);

      const sheet = findInBody('[data-testid="person-edit-sheet"]')!;
      await setInputValue(sheet.querySelector('input') as HTMLInputElement, 'Алексей Петров');
      (sheet.querySelector('[data-testid="save-person-btn"]') as HTMLElement).click();
      await flushPromises();
      await flushPromises();

      expect(patchBody).not.toBeNull();
      expect(patchBody!.name).toBe('Алексей Петров');
    });

    it('links to the debts page when the person has debts', async () => {
      withPeople(mockPersonResponse);
      withDebts(mockGivenDebtResponse);
      const wrapper = await renderPage();

      await openEditSheet(wrapper);

      const link = findInBody('[data-testid="person-debts-link"]');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe('/debts');
    });

    it('hides the debts link when the person has none', async () => {
      withPeople(mockSecondPersonResponse);
      const wrapper = await renderPage();

      await openEditSheet(wrapper);

      expect(findInBody('[data-testid="person-debts-link"]')).toBeNull();
    });

    it('disables save when the name is emptied', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();
      await openEditSheet(wrapper);

      const sheet = findInBody('[data-testid="person-edit-sheet"]')!;
      await setInputValue(sheet.querySelector('input') as HTMLInputElement, '   ');

      const saveBtn = sheet.querySelector('[data-testid="save-person-btn"]') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });
  });

  describe('delete person', () => {
    it('deletes after confirmation triggered from a swipe', async () => {
      withPeople(mockPersonResponse);
      let deletedId: string | null = null;
      server.use(
        http.delete('*/api/people/:id', ({ params }) => {
          deletedId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const wrapper = await renderPage();

      wrapper.findComponent({ name: 'SwipeableItem' }).vm.$emit('action-left');
      await nextTick();

      const confirmModal = wrapper.findComponent({ name: 'ConfirmDeleteModal' });
      expect(confirmModal.props('modelValue')).toBe(true);

      confirmModal.vm.$emit('confirm');
      await flushPromises();
      await flushPromises();

      expect(deletedId).toBe('person-1');
    });

    it('opens the confirmation from the edit sheet', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();
      await openEditSheet(wrapper);

      const sheet = findInBody('[data-testid="person-edit-sheet"]')!;
      (sheet.querySelector('[data-testid="delete-person-btn"]') as HTMLElement).click();
      await flushPromises();
      await nextTick();

      expect(wrapper.findComponent({ name: 'ConfirmDeleteModal' }).props('modelValue')).toBe(true);
    });

    it('cancels delete when cancel is clicked', async () => {
      withPeople(mockPersonResponse);
      const wrapper = await renderPage();

      wrapper.findComponent({ name: 'SwipeableItem' }).vm.$emit('action-left');
      await nextTick();

      const confirmModal = wrapper.findComponent({ name: 'ConfirmDeleteModal' });
      expect(confirmModal.props('modelValue')).toBe(true);

      confirmModal.vm.$emit('cancel');
      await nextTick();

      expect(confirmModal.props('modelValue')).toBe(false);
    });
  });

  describe('loading state', () => {
    it('shows skeleton while people load', async () => {
      server.use(
        http.get('*/api/people', async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
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
      await nextTick();

      expect(currentWrapper.find('[data-testid="people-loading"]').exists()).toBe(true);
    });
  });

  describe('empty state', () => {
    it('shows empty state when there are no people', async () => {
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="people-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Нет контактов');
    });
  });

  describe('back navigation', () => {
    it('calls navigateBack when the back button is clicked', async () => {
      const wrapper = await renderPage();

      await wrapper.find('header button').trigger('click');

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('keeps the typed name when create fails', async () => {
      server.use(http.post('*/api/people', () => new HttpResponse(null, { status: 500 })));

      const wrapper = await renderPage();
      await typeQuery(wrapper, 'Дмитрий');
      await wrapper.find('[data-testid="create-person-btn"]').trigger('click');
      await flushPromises();
      await flushPromises();

      // Имя не потеряно — пользователь может повторить, не набирая заново
      expect(wrapper.find('[data-testid="create-person-btn"]').exists()).toBe(true);
    });

    it('keeps the sheet open when update fails', async () => {
      withPeople(mockPersonResponse);
      server.use(http.patch('*/api/people/:id', () => new HttpResponse(null, { status: 500 })));

      const wrapper = await renderPage();
      await openEditSheet(wrapper);

      const sheet = findInBody('[data-testid="person-edit-sheet"]')!;
      await setInputValue(sheet.querySelector('input') as HTMLInputElement, 'Новое имя');
      (sheet.querySelector('[data-testid="save-person-btn"]') as HTMLElement).click();
      await flushPromises();
      await flushPromises();

      expect(findInBody('[data-testid="person-edit-sheet"]')).not.toBeNull();
    });
  });
});
