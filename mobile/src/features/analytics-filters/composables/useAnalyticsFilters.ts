import { useState } from 'react';

export function useAnalyticsFilters() {
  const [accountIds, setAccountIds] = useState<string[] | null>(null);
  const [categoryIds, setCategoryIds] = useState<string[] | null>(null);
  return { accountIds, setAccountIds, categoryIds, setCategoryIds };
}
