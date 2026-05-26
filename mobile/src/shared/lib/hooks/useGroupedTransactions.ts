import { useMemo } from 'react';

import type { Transaction } from '@/entities/transaction';
import { formatDateGroup } from '@/shared/lib/format/date';

export interface TransactionGroup {
  title: string;
  data: Transaction[];
}

export function useGroupedTransactions(transactions: Transaction[]): TransactionGroup[] {
  return useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const key = tx.date.slice(0, 10);
      const list = map.get(key);
      if (list) {
        list.push(tx);
      } else {
        map.set(key, [tx]);
      }
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: formatDateGroup(date),
      data,
    }));
  }, [transactions]);
}
