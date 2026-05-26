import { useState } from 'react';

export type TransactionTypeFilter = 'all' | 'income' | 'expense';

export function useHistoryFilters() {
  const [type, setType] = useState<TransactionTypeFilter>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  return { type, setType, accountId, setAccountId, query, setQuery };
}
