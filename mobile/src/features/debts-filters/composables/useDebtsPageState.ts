import { useState } from 'react';

export type DebtDirection = 'all' | 'owed_to_me' | 'i_owe';

export function useDebtsPageState() {
  const [direction, setDirection] = useState<DebtDirection>('all');
  const [currency, setCurrency] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  return { direction, setDirection, currency, setCurrency, showClosed, setShowClosed };
}
