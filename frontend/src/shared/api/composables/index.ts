// Auth and Profile stay in shared
export { useAuth, initializeAuth, getCurrentUser, waitForAuth } from './useAuth';
export { useProfile } from './useProfile';
export { useExchangeRates } from './useExchangeRates';

// Re-export from entities for backward compatibility (API-only to avoid pulling UI components)
export { useAccounts } from '@/entities/account/api';
export { useTransactions } from '@/entities/transaction/api';
export { useGoals } from '@/entities/goal/api';
export { useDebts } from '@/entities/debt/api';
