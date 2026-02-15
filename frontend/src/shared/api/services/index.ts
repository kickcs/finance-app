// Profile API stays in shared
export { profileApi } from './profileApi';
export { exchangeRatesApi } from './exchangeRatesApi';

// Re-export from entities for backward compatibility
export { accountsApi } from '@/entities/account';
export { transactionsApi } from '@/entities/transaction';
export { goalsApi } from '@/entities/goal';
export { debtsApi } from '@/entities/debt';
export { remindersApi } from '@/entities/reminder';
