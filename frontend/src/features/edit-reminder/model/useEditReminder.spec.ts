import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useEditReminder } from './useEditReminder';
import { mockReminderResponse } from '@/test/mocks/handlers/reminders';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';
const REMINDER_ID = 'rem-1';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable(userId: string | null = USER_ID) {
  let result!: ReturnType<typeof useEditReminder>;
  const userIdRef = ref(userId);
  const Stub = defineComponent({
    setup() {
      result = useEditReminder(userIdRef);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useEditReminder', () => {
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
    it('starts with isUpdating and isDeleting both false', () => {
      const c = mountComposable();
      expect(c.isUpdating.value).toBe(false);
      expect(c.isDeleting.value).toBe(false);
    });

    it('starts with no error', () => {
      const c = mountComposable();
      expect(c.error.value).toBeNull();
    });
  });

  // ── update ────────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls PATCH /api/reminders/:id with updates', async () => {
      let patchBody: Record<string, unknown> | null = null;
      let patchId: string | null = null;

      server.use(
        http.patch('*/api/reminders/:id', async ({ request, params }) => {
          patchId = params.id as string;
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, ...patchBody, id: patchId });
        }),
      );

      const c = mountComposable();

      await c.update(REMINDER_ID, { name: 'Яндекс Плюс', amount: 299 });
      await flushPromises();

      expect(patchId).toBe(REMINDER_ID);
      expect((patchBody as Record<string, unknown> | null)?.name).toBe('Яндекс Плюс');
      expect((patchBody as Record<string, unknown> | null)?.amount).toBe(299);
    });

    it('shows success toast after successful update', async () => {
      server.use(
        http.patch('*/api/reminders/:id', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, ...body });
        }),
      );

      const c = mountComposable();

      await c.update(REMINDER_ID, { name: 'Updated Name' });
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('returns true on successful update', async () => {
      server.use(
        http.patch('*/api/reminders/:id', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, ...body });
        }),
      );

      const c = mountComposable();

      const result = await c.update(REMINDER_ID, { name: 'Netflix' });
      await flushPromises();

      expect(result).toBe(true);
    });

    it('can update frequency and next_date', async () => {
      let patchBody: Record<string, unknown> | null = null;

      server.use(
        http.patch('*/api/reminders/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, ...patchBody });
        }),
      );

      const c = mountComposable();

      await c.update(REMINDER_ID, { frequency: 'yearly', next_date: '2027-04-01' });
      await flushPromises();

      expect((patchBody as Record<string, unknown> | null)?.frequency).toBe('yearly');
      // API transforms next_date → nextDate
      expect((patchBody as Record<string, unknown> | null)?.nextDate).toBe('2027-04-01');
    });

    it('sets error and returns false on API failure', async () => {
      server.use(
        http.patch('*/api/reminders/:id', () => {
          return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();

      const result = await c.update(REMINDER_ID, { name: 'Netflix' });
      await flushPromises();

      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('sets isUpdating to true during request and false after', async () => {
      let resolveRequest!: () => void;
      const pending = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.patch('*/api/reminders/:id', async () => {
          await pending;
          return HttpResponse.json(mockReminderResponse);
        }),
      );

      const c = mountComposable();

      const promise = c.update(REMINDER_ID, { name: 'Test' });
      expect(c.isUpdating.value).toBe(true);

      resolveRequest();
      await promise;
      await flushPromises();

      expect(c.isUpdating.value).toBe(false);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('calls DELETE /api/reminders/:id', async () => {
      let deletedId: string | null = null;

      server.use(
        http.delete('*/api/reminders/:id', ({ params }) => {
          deletedId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();

      await c.remove(REMINDER_ID);
      await flushPromises();

      expect(deletedId).toBe(REMINDER_ID);
    });

    it('shows success toast after deletion', async () => {
      server.use(
        http.delete('*/api/reminders/:id', () => {
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();

      await c.remove(REMINDER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('returns true on successful deletion', async () => {
      server.use(
        http.delete('*/api/reminders/:id', () => {
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();

      const result = await c.remove(REMINDER_ID);
      await flushPromises();

      expect(result).toBe(true);
    });

    it('sets error and returns false on deletion failure', async () => {
      server.use(
        http.delete('*/api/reminders/:id', () => {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        }),
      );

      const c = mountComposable();

      const result = await c.remove(REMINDER_ID);
      await flushPromises();

      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('sets isDeleting to true during request and false after', async () => {
      let resolveRequest!: () => void;
      const pending = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.delete('*/api/reminders/:id', async () => {
          await pending;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();

      const promise = c.remove(REMINDER_ID);
      expect(c.isDeleting.value).toBe(true);

      resolveRequest();
      await promise;
      await flushPromises();

      expect(c.isDeleting.value).toBe(false);
    });
  });

  // ── error computed ────────────────────────────────────────────────────

  describe('error computed', () => {
    it('reflects update error', async () => {
      server.use(
        http.patch('*/api/reminders/:id', () => {
          return HttpResponse.json({ message: 'Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();
      await c.update(REMINDER_ID, { name: 'Test' });
      await flushPromises();

      expect(c.error.value).toBe('Не удалось обновить подписку');
    });

    it('reflects delete error', async () => {
      server.use(
        http.delete('*/api/reminders/:id', () => {
          return HttpResponse.json({ message: 'Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();
      await c.remove(REMINDER_ID);
      await flushPromises();

      expect(c.error.value).toBe('Не удалось удалить подписку');
    });
  });
});
