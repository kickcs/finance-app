import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { debtsApi } from '@/entities/debt/api/debtsApi';
import { transactionsApi } from '@/entities/transaction/api/transactionsApi';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { invalidateDebtRelated, invalidateTransactionRelated } from '@/shared/api/invalidation';

import type { ScanReceiptResponse } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptParticipant {
  /** Drawn from the Person entity list — person.id */
  id: string;
  name: string;
  color: string;
}

export interface ReceiptSubmitParams {
  accountId: string;
  categoryId: string;
  currency: string;
  description?: string;
  storeName: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the "Step 3: assign participants" state for the scan-receipt flow.
 *
 * Simplified model (vs Vue frontend full per-item split):
 * - The user picks which PEOPLE share the whole receipt.
 * - Each selected person owes an equal share: `totalAmount / (selectedCount + 1)`
 *   where the "+1" is the current user (owner). Rounding remainder stays with
 *   the owner so the sum is always exactly totalAmount.
 * - On submit: ONE transaction + one `given` debt per selected participant,
 *   all linked via `source_transaction_id`.
 *
 * Full per-item assignment is deferred (see report).
 */
export function useReceiptParticipants() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const qc = useQueryClient();

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  const toggleParticipant = useCallback((personId: string) => {
    setSelectedIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  // -------------------------------------------------------------------------
  // Share calculation
  // -------------------------------------------------------------------------

  /**
   * Returns the per-person share for each selected participant.
   * Owner's share = totalAmount − sum of participant shares (absorbs rounding).
   */
  function calcShares(
    totalAmount: number,
    participants: ReceiptParticipant[],
  ): Map<string, number> {
    const selected = participants.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) return new Map();

    // +1 for the current user (owner)
    const divisor = selected.length + 1;
    const baseShare = Math.floor(totalAmount / divisor);
    const shares = new Map<string, number>();
    selected.forEach((p) => shares.set(p.id, baseShare));
    return shares;
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async function submit(
    userId: string,
    result: ScanReceiptResponse,
    participants: ReceiptParticipant[],
    params: ReceiptSubmitParams,
  ) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Create the main expense transaction
      const transaction = await transactionsApi.create({
        account_id: params.accountId,
        category_id: params.categoryId,
        amount: result.totalAmount,
        currency: params.currency,
        type: 'expense',
        description: params.description ?? params.storeName ?? null,
        date: result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
        is_debt_related: selectedIds.length > 0,
      });

      // 2. Create debts for each selected participant
      if (selectedIds.length > 0) {
        const shares = calcShares(result.totalAmount, participants);
        const selectedParticipants = participants.filter((p) => selectedIds.includes(p.id));

        await Promise.all(
          selectedParticipants.map((participant) => {
            const share = shares.get(participant.id) ?? 0;
            if (share <= 0) return Promise.resolve();
            return debtsApi.create({
              name: `Чек: ${result.storeName ?? 'Без названия'}`,
              total_amount: share,
              remaining_amount: share,
              debt_type: 'given',
              person_name: participant.name,
              account_id: params.accountId,
              currency: params.currency,
              source_transaction_id: transaction.id,
            });
          }),
        );
      }

      // 3. Invalidate caches
      await Promise.all([
        invalidateTransactionRelated(qc),
        ...(selectedIds.length > 0 ? [invalidateDebtRelated(qc)] : []),
      ]);

      setIsSuccess(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось сохранить чек';
      setSubmitError(message);
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    selectedIds,
    isSubmitting,
    submitError,
    isSuccess,
    toggleParticipant,
    clearSelection,
    calcShares,
    submit,
    reset: () => {
      setSelectedIds([]);
      setSubmitError(null);
      setIsSuccess(false);
    },
  };
}

/**
 * Map a Person entity list into ReceiptParticipant shape, assigning colors
 * from the shared ENTITY_COLORS palette by index (stable across renders
 * because the people list is sorted by creation order from the API).
 */
export function toReceiptParticipants(
  people: Array<{ id: string; name: string; color?: string }>,
): ReceiptParticipant[] {
  return people.map((p, idx) => ({
    id: p.id,
    name: p.name,
    color: p.color ?? (ENTITY_COLORS[idx % ENTITY_COLORS.length] as string),
  }));
}
