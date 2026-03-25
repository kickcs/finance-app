import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useEditDebt } from './useEditDebt';
import type { Debt } from '@/shared/api/database.types';
import { mockGivenDebtResponse } from '@/test/mocks/handlers/debts';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock, hapticMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  hapticMock: vi.fn(),
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/lib/haptics', () => ({
  useHaptics: () => ({ trigger: hapticMock }),
}));

vi.mock('@/shared/api/invalidation', () => ({
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';

// ── Helpers ────────────────────────────────────────────────────────────────

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: mockUser.id,
    name: 'Долг от Алексей',
    total_amount: 50000,
    remaining_amount: 30000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2025-01-15T12:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алексей',
    account_id: 'acc-1',
    transaction_id: 'tx-debt-1',
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: 'Тестовый долг',
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    ...overrides,
  };
}

function mountComposable(debt: Debt | null = makeDebt()) {
  const debtRef = ref<Debt | null>(debt);
  let result!: ReturnType<typeof useEditDebt>;

  const Stub = defineComponent({
    setup() {
      result = useEditDebt(() => debtRef.value, mockUser.id);
      return () => h('div');
    },
  });

  currentWrapper = renderWithProviders(Stub, { provideAuth: { user: mockUser } });
  return { result, debtRef };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useEditDebt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initialization ────────────────────────────────────────────────────

  describe('initialization', () => {
    it('initializes form from debt data', () => {
      const { result } = mountComposable(makeDebt({ person_name: 'Олег', total_amount: 100000 }));
      expect(result.formData.value.person_name).toBe('Олег');
      expect(result.formData.value.total_amount).toBe(100000);
    });

    it('handles null debt', () => {
      const { result } = mountComposable(null);
      expect(result.formData.value.person_name).toBe('');
      expect(result.formData.value.total_amount).toBe(0);
    });

    it('starts clean (not dirty)', () => {
      const { result } = mountComposable();
      expect(result.isDirty.value).toBe(false);
    });

    it('re-initializes when debt changes', async () => {
      const { result, debtRef } = mountComposable(makeDebt({ person_name: 'Олег' }));
      expect(result.formData.value.person_name).toBe('Олег');

      debtRef.value = makeDebt({ person_name: 'Анвар' });
      await nextTick();

      expect(result.formData.value.person_name).toBe('Анвар');
      expect(result.isDirty.value).toBe(false);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('is valid with non-empty name and positive amount', () => {
      const { result } = mountComposable();
      expect(result.isValid.value).toBe(true);
    });

    it('is invalid with empty name', () => {
      const { result } = mountComposable(makeDebt({ person_name: '' }));
      expect(result.isValid.value).toBe(false);
    });

    it('is invalid with whitespace-only name', () => {
      const { result } = mountComposable(makeDebt({ person_name: '   ' }));
      expect(result.isValid.value).toBe(false);
    });

    it('is invalid with zero amount', () => {
      const { result } = mountComposable(makeDebt({ total_amount: 0 }));
      expect(result.isValid.value).toBe(false);
    });
  });

  // ── Dirty tracking ────────────────────────────────────────────────────

  describe('dirty tracking', () => {
    it('becomes dirty when field changes', () => {
      const { result } = mountComposable();
      result.updateField('person_name', 'Новое имя');
      expect(result.isDirty.value).toBe(true);
    });

    it('becomes clean when reverted to original', () => {
      const debt = makeDebt({ person_name: 'Олег' });
      const { result } = mountComposable(debt);

      result.updateField('person_name', 'Другое');
      expect(result.isDirty.value).toBe(true);

      result.updateField('person_name', 'Олег');
      expect(result.isDirty.value).toBe(false);
    });

    it('reset restores original values', () => {
      const { result } = mountComposable(makeDebt({ person_name: 'Олег' }));
      result.updateField('person_name', 'Изменённое');
      result.updateField('total_amount', 999);

      result.reset();

      expect(result.formData.value.person_name).toBe('Олег');
      expect(result.isDirty.value).toBe(false);
    });
  });

  // ── Warnings ──────────────────────────────────────────────────────────

  describe('warnings', () => {
    it('shows warning when amount changes and debt has linked transaction', () => {
      const { result } = mountComposable(makeDebt({ transaction_id: 'tx-1' }));
      result.updateField('total_amount', 99999);
      expect(result.warnings.value).toHaveLength(1);
      expect(result.warnings.value[0]).toContain('транзакции');
    });

    it('no warning when amount changes but no linked transaction', () => {
      const { result } = mountComposable(makeDebt({ transaction_id: null }));
      result.updateField('total_amount', 99999);
      expect(result.warnings.value).toHaveLength(0);
    });

    it('no warning when amount unchanged', () => {
      const { result } = mountComposable(makeDebt({ transaction_id: 'tx-1' }));
      result.updateField('person_name', 'Другой');
      expect(result.warnings.value).toHaveLength(0);
    });
  });

  // ── Submit ────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('does not submit when not dirty', async () => {
      const patchSpy = vi.fn();
      server.use(
        http.patch('*/api/debts/:id', () => {
          patchSpy();
          return HttpResponse.json(mockGivenDebtResponse);
        }),
      );

      const { result } = mountComposable();
      const success = await result.submit();

      expect(success).toBe(false);
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('does not submit when invalid', async () => {
      const { result } = mountComposable(makeDebt({ person_name: '' }));
      result.updateField('total_amount', 999);
      const success = await result.submit();
      expect(success).toBe(false);
    });

    it('sends only changed fields', async () => {
      let patchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockGivenDebtResponse);
        }),
      );

      const { result } = mountComposable();
      result.updateField('person_name', 'Новое имя');
      await result.submit();
      await flushPromises();

      expect(patchBody).toHaveProperty('personName', 'Новое имя');
      expect(patchBody).not.toHaveProperty('totalAmount');
      expect(patchBody).not.toHaveProperty('isPrivate');
    });

    it('adjusts remaining_amount by delta when total changes', async () => {
      let patchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockGivenDebtResponse);
        }),
      );

      // Debt: total=50000, remaining=30000 (paid 20000)
      const { result } = mountComposable(
        makeDebt({
          total_amount: 50000,
          remaining_amount: 30000,
        }),
      );
      result.updateField('total_amount', 70000); // +20000
      await result.submit();
      await flushPromises();

      // remaining should be 30000 + 20000 = 50000
      expect(patchBody).toHaveProperty('totalAmount', 70000);
      expect(patchBody).toHaveProperty('remainingAmount', 50000);
    });

    it('clamps remaining to 0 when total decreases below paid', async () => {
      let patchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockGivenDebtResponse);
        }),
      );

      // Debt: total=50000, remaining=30000 (paid 20000)
      // Decrease total to 10000 → remaining = 30000 + (10000-50000) = -10000 → clamped to 0
      const { result } = mountComposable(
        makeDebt({
          total_amount: 50000,
          remaining_amount: 30000,
        }),
      );
      result.updateField('total_amount', 10000);
      await result.submit();
      await flushPromises();

      expect(patchBody).toHaveProperty('remainingAmount', 0);
    });

    it('updates linked transaction when amount changes', async () => {
      let txPatchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.patch('*/api/transactions/:id', async ({ request }) => {
          txPatchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: 'tx-debt-1' });
        }),
      );

      const { result } = mountComposable(makeDebt({ transaction_id: 'tx-debt-1' }));
      result.updateField('total_amount', 75000);
      await result.submit();
      await flushPromises();

      expect(txPatchBody).toHaveProperty('amount', 75000);
    });

    it('does NOT update transaction when amount unchanged', async () => {
      const txPatchSpy = vi.fn();
      server.use(
        http.patch('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.patch('*/api/transactions/:id', () => {
          txPatchSpy();
          return HttpResponse.json({});
        }),
      );

      const { result } = mountComposable(makeDebt({ transaction_id: 'tx-debt-1' }));
      result.updateField('person_name', 'Другое имя');
      await result.submit();
      await flushPromises();

      expect(txPatchSpy).not.toHaveBeenCalled();
    });

    it('does NOT update transaction when no transaction_id', async () => {
      const txPatchSpy = vi.fn();
      server.use(
        http.patch('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.patch('*/api/transactions/:id', () => {
          txPatchSpy();
          return HttpResponse.json({});
        }),
      );

      const { result } = mountComposable(makeDebt({ transaction_id: null }));
      result.updateField('total_amount', 99000);
      await result.submit();
      await flushPromises();

      expect(txPatchSpy).not.toHaveBeenCalled();
    });

    it('invalidates caches after transaction update', async () => {
      server.use(
        http.patch('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.patch('*/api/transactions/:id', () => HttpResponse.json({})),
      );

      const { result } = mountComposable(makeDebt({ transaction_id: 'tx-1' }));
      result.updateField('total_amount', 99000);
      await result.submit();
      await flushPromises();

      expect(invalidateTransactionRelated).toHaveBeenCalled();
      expect(invalidateAccountRelated).toHaveBeenCalled();
    });

    it('shows success toast and haptic on success', async () => {
      server.use(http.patch('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)));

      const { result } = mountComposable();
      result.updateField('description', 'Новое описание');
      await result.submit();
      await flushPromises();

      expect(hapticMock).toHaveBeenCalledWith('success');
      expect(toastMock).toHaveBeenCalledWith({ title: 'Долг обновлён' });
    });

    it('shows error toast on failure', async () => {
      server.use(http.patch('*/api/debts/:id', () => HttpResponse.json({}, { status: 500 })));

      const { result } = mountComposable();
      result.updateField('description', 'Тест');
      const success = await result.submit();
      await flushPromises();

      expect(success).toBe(false);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('sends description as null when cleared', async () => {
      let patchBody: Record<string, unknown> = {};
      server.use(
        http.patch('*/api/debts/:id', async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockGivenDebtResponse);
        }),
      );

      const { result } = mountComposable(makeDebt({ description: 'Старое' }));
      result.updateField('description', '');
      await result.submit();
      await flushPromises();

      expect(patchBody).toHaveProperty('description', null);
    });
  });
});
