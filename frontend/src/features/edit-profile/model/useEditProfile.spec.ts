import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useEditProfile } from './useEditProfile';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable(userId: string | null = USER_ID) {
  let result!: ReturnType<typeof useEditProfile>;
  const userIdRef = ref(userId);
  const Stub = defineComponent({
    setup() {
      result = useEditProfile(userIdRef);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useEditProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── initial state ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty name', () => {
      const c = mountComposable();
      expect(c.formData.value.name).toBe('');
    });

    it('is not submitting initially', () => {
      const c = mountComposable();
      expect(c.isSubmitting.value).toBe(false);
    });

    it('isValid is false when name is empty', () => {
      const c = mountComposable();
      expect(c.isValid.value).toBe(false);
    });
  });

  // ── isValid ─────────────────────────────────────────────────────────────

  describe('isValid', () => {
    it('is false when name is empty string', () => {
      const c = mountComposable();
      c.updateField('name', '');
      expect(c.isValid.value).toBe(false);
    });

    it('is false when name is whitespace only', () => {
      const c = mountComposable();
      c.updateField('name', '   ');
      expect(c.isValid.value).toBe(false);
    });

    it('is true when name has at least one character', () => {
      const c = mountComposable();
      c.updateField('name', 'Иван');
      expect(c.isValid.value).toBe(true);
    });
  });

  // ── initForm ─────────────────────────────────────────────────────────────

  describe('initForm', () => {
    it('sets form name from loaded profile', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () => {
          return HttpResponse.json({ ...mockProfileResponse, name: 'Алексей' });
        }),
        http.get('*/api/profiles/me', () => {
          return HttpResponse.json({ ...mockProfileResponse, name: 'Алексей' });
        }),
      );

      const c = mountComposable();
      await flushPromises(); // wait for profile query to resolve

      c.initForm();

      expect(c.formData.value.name).toBe('Алексей');
    });

    it('sets name to empty string if profile has no name', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () => {
          return HttpResponse.json({ ...mockProfileResponse, name: null });
        }),
        http.get('*/api/profiles/me', () => {
          return HttpResponse.json({ ...mockProfileResponse, name: null });
        }),
      );

      const c = mountComposable();
      await flushPromises();

      c.initForm();

      expect(c.formData.value.name).toBe('');
    });
  });

  // ── updateField ──────────────────────────────────────────────────────────

  describe('updateField', () => {
    it('updates name field correctly', () => {
      const c = mountComposable();
      c.updateField('name', 'Мария');
      expect(c.formData.value.name).toBe('Мария');
    });
  });

  // ── saveProfile — success ────────────────────────────────────────────────

  describe('saveProfile — success', () => {
    it('calls PATCH /api/profiles/me with trimmed name', async () => {
      let patchBody: Record<string, unknown> | null = null;

      server.use(
        http.patch('*/api/profiles/me', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...patchBody });
        }),
      );

      const c = mountComposable();
      c.updateField('name', '  Иван  ');

      await c.saveProfile();
      await flushPromises();

      expect((patchBody as Record<string, unknown> | null)?.name).toBe('Иван');
    });

    it('does not call API when name is invalid', async () => {
      const patchSpy = vi.fn();

      server.use(
        http.patch('*/api/profiles/me', async () => {
          patchSpy();
          return HttpResponse.json(mockProfileResponse);
        }),
      );

      const c = mountComposable();
      // name is empty — invalid

      await c.saveProfile();
      await flushPromises();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('does not call API when userId is null', async () => {
      const patchSpy = vi.fn();

      server.use(
        http.patch('*/api/profiles/me', async () => {
          patchSpy();
          return HttpResponse.json(mockProfileResponse);
        }),
      );

      const c = mountComposable(null);
      c.updateField('name', 'Иван');

      await c.saveProfile();
      await flushPromises();

      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('sets isSubmitting to true during save and false after', async () => {
      let resolveRequest!: () => void;
      const pending = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.patch('*/api/profiles/me', async () => {
          await pending;
          return HttpResponse.json(mockProfileResponse);
        }),
      );

      const c = mountComposable();
      c.updateField('name', 'Иван');

      const promise = c.saveProfile();
      expect(c.isSubmitting.value).toBe(true);

      resolveRequest();
      await promise;
      await flushPromises();

      expect(c.isSubmitting.value).toBe(false);
    });

    it('resets isSubmitting to false even after error', async () => {
      server.use(
        http.patch('*/api/profiles/me', () => {
          return HttpResponse.json({ message: 'Server Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();
      c.updateField('name', 'Иван');

      // mutateAsync propagates the error — catch to avoid unhandled rejection
      await c.saveProfile().catch(() => {});
      await flushPromises();

      expect(c.isSubmitting.value).toBe(false);
    });

    it('does not submit a second time while already submitting', async () => {
      let callCount = 0;
      let resolveFirst!: () => void;
      const firstRequest = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      server.use(
        http.patch('*/api/profiles/me', async () => {
          callCount++;
          await firstRequest;
          return HttpResponse.json(mockProfileResponse);
        }),
      );

      const c = mountComposable();
      c.updateField('name', 'Иван');

      const first = c.saveProfile();
      // isSubmitting is now true; second call should be ignored
      const second = c.saveProfile();

      resolveFirst();
      await Promise.all([first, second]);
      await flushPromises();

      expect(callCount).toBe(1);
    });
  });
});
