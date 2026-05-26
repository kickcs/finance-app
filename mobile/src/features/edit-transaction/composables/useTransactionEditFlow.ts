import { useState, useCallback } from 'react';

import type { Transaction } from '@/shared/api/database.types';

export function useTransactionEditFlow() {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const openEdit = useCallback((t: Transaction) => setEditing(t), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const openDelete = useCallback((t: Transaction) => setDeleting(t), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  return { editing, deleting, openEdit, closeEdit, openDelete, closeDelete };
}
