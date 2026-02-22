// Auth and Profile stay in shared
export { useAuth, initializeAuth, getCurrentUser, waitForAuth } from './useAuth';
export { useProfile } from './useProfile';
export { useExchangeRates } from './useExchangeRates';

// Re-export from entities for backward compatibility
export { useAccounts } from '@/entities/account';
export { useTransactions } from '@/entities/transaction';
export { useGoals } from '@/entities/goal';
export { useDebts } from '@/entities/debt';
export { useReminders } from '@/entities/reminder';
