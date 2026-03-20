import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useCreateReminder } from './useCreateReminder';
import { mockReminderResponse } from '@/test/mocks/handlers/reminders';
import { REMINDER_ICONS } from '@/entities/reminder';
import { ENTITY_COLORS } from '@/shared/config/colors';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useCreateReminder>;
  const Stub = defineComponent({
    setup() {
      result = useCreateReminder();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

function fillValidForm(c: ReturnType<typeof useCreateReminder>) {
  c.updateField('name', 'Netflix');
  c.updateField('amount', 15000);
  c.updateField('frequency', 'monthly');
  c.updateField('next_date', '2027-01-01');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useCreateReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ─────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has empty name and zero amount', () => {
      const c = mountComposable();
      expect(c.formData.value.name).toBe('');
      expect(c.formData.value.amount).toBe(0);
    });

    it('has default frequency of monthly', () => {
      const c = mountComposable();
      expect(c.formData.value.frequency).toBe('monthly');
    });

    it('has a default next_date one month in the future', () => {
      const c = mountComposable();
      const nextDate = new Date(c.formData.value.next_date);
      const now = new Date();
      // It should be approximately 1 month ahead — just verify it is in the future
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('has default icon and color', () => {
      const c = mountComposable();
      expect(c.formData.value.icon).toBe(REMINDER_ICONS[0]);
      expect(c.formData.value.color).toBe(ENTITY_COLORS[0]);
    });

    it('has no error and is not submitting', () => {
      const c = mountComposable();
      expect(c.error.value).toBeNull();
      expect(c.isSubmitting.value).toBe(false);
    });
  });

  // ── isValid ─────────────────────────────────────────────────────────────

  describe('isValid', () => {
    it('is false on empty form', () => {
      const c = mountComposable();
      expect(c.isValid.value).toBe(false);
    });

    it('is false when name is whitespace only', () => {
      const c = mountComposable();
      c.updateField('name', '   ');
      c.updateField('amount', 15000);
      expect(c.isValid.value).toBe(false);
    });

    it('is false when amount is 0', () => {
      const c = mountComposable();
      c.updateField('name', 'Netflix');
      c.updateField('amount', 0);
      expect(c.isValid.value).toBe(false);
    });

    it('is false when name is filled but amount is 0', () => {
      const c = mountComposable();
      c.updateField('name', 'Netflix');
      expect(c.isValid.value).toBe(false);
    });

    it('is true when name and positive amount are filled', () => {
      const c = mountComposable();
      fillValidForm(c);
      expect(c.isValid.value).toBe(true);
    });
  });

  // ── createReminder — happy path ──────────────────────────────────────────

  describe('createReminder — success', () => {
    it('calls POST /api/reminders with correct body', async () => {
      let requestBody: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/reminders', async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, id: 'rem-new-1' });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      await c.createReminder(USER_ID);

      expect((requestBody as Record<string, unknown> | null)?.name).toBe('Netflix');
      expect((requestBody as Record<string, unknown> | null)?.amount).toBe(15000);
      expect((requestBody as Record<string, unknown> | null)?.frequency).toBe('monthly');
      expect((requestBody as Record<string, unknown> | null)?.nextDate).toBe('2027-01-01');
    });

    it('returns the new reminder id on success', async () => {
      server.use(
        http.post('*/api/reminders', async () => {
          return HttpResponse.json({ ...mockReminderResponse, id: 'rem-new-2' });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      const result = await c.createReminder(USER_ID);

      expect(result).toBe('rem-new-2');
    });

    it('shows success toast after creation', async () => {
      server.use(
        http.post('*/api/reminders', async () => {
          return HttpResponse.json({ ...mockReminderResponse, id: 'rem-new-3' });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      await c.createReminder(USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('trims name before sending', async () => {
      let requestBody: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/reminders', async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockReminderResponse, id: 'rem-trim-1' });
        }),
      );

      const c = mountComposable();
      c.updateField('name', '  Netflix  ');
      c.updateField('amount', 15000);
      c.updateField('next_date', '2027-01-01');

      await c.createReminder(USER_ID);

      expect((requestBody as Record<string, unknown> | null)?.name).toBe('Netflix');
    });

    it('sets isSubmitting to true during request and false after', async () => {
      let resolveRequest!: () => void;
      const pending = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });

      server.use(
        http.post('*/api/reminders', async () => {
          await pending;
          return HttpResponse.json({ ...mockReminderResponse, id: 'rem-loading-1' });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      const promise = c.createReminder(USER_ID);
      // At this point the request is pending — isSubmitting should be true
      expect(c.isSubmitting.value).toBe(true);

      resolveRequest();
      await promise;

      expect(c.isSubmitting.value).toBe(false);
    });
  });

  // ── createReminder — validation ──────────────────────────────────────────

  describe('createReminder — invalid form', () => {
    it('returns null and sets error without calling API', async () => {
      const postSpy = vi.fn();
      server.use(
        http.post('*/api/reminders', () => {
          postSpy();
          return HttpResponse.json(mockReminderResponse);
        }),
      );

      const c = mountComposable(); // empty form

      const result = await c.createReminder(USER_ID);

      expect(result).toBeNull();
      expect(c.error.value).toBeTruthy();
      expect(postSpy).not.toHaveBeenCalled();
    });
  });

  // ── createReminder — error handling ──────────────────────────────────────

  describe('createReminder — API error', () => {
    it('sets error and shows error toast on API failure', async () => {
      server.use(
        http.post('*/api/reminders', () => {
          return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      const result = await c.createReminder(USER_ID);
      await flushPromises();

      expect(result).toBeNull();
      expect(c.error.value).toBeTruthy();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('resets isSubmitting to false after API error', async () => {
      server.use(
        http.post('*/api/reminders', () => {
          return HttpResponse.json({ message: 'Error' }, { status: 500 });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      await c.createReminder(USER_ID);

      expect(c.isSubmitting.value).toBe(false);
    });
  });

  // ── updateField ──────────────────────────────────────────────────────────

  describe('updateField', () => {
    it('updates a specific field without touching others', () => {
      const c = mountComposable();
      c.updateField('name', 'Spotify');
      c.updateField('amount', 9990);

      expect(c.formData.value.name).toBe('Spotify');
      expect(c.formData.value.amount).toBe(9990);
      expect(c.formData.value.frequency).toBe('monthly'); // untouched
    });

    it('can update frequency', () => {
      const c = mountComposable();
      c.updateField('frequency', 'yearly');
      expect(c.formData.value.frequency).toBe('yearly');
    });

    it('can update icon and color', () => {
      const c = mountComposable();
      c.updateField('icon', 'wifi');
      c.updateField('color', '#3b82f6');
      expect(c.formData.value.icon).toBe('wifi');
      expect(c.formData.value.color).toBe('#3b82f6');
    });
  });

  // ── resetForm ────────────────────────────────────────────────────────────

  describe('resetForm', () => {
    it('resets all fields to initial values', () => {
      const c = mountComposable();
      fillValidForm(c);
      c.error.value = 'Какая-то ошибка';

      c.resetForm();

      expect(c.formData.value.name).toBe('');
      expect(c.formData.value.amount).toBe(0);
      expect(c.formData.value.frequency).toBe('monthly');
      expect(c.formData.value.icon).toBe(REMINDER_ICONS[0]);
      expect(c.formData.value.color).toBe(ENTITY_COLORS[0]);
      expect(c.error.value).toBeNull();
    });
  });
});
