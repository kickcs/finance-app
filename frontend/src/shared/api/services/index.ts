// Profile API stays in shared
export { profileApi } from './profileApi';
export { exchangeRatesApi } from './exchangeRatesApi';

// Re-export from entities for backward compatibility (API-only to avoid pulling UI components)
export { accountsApi } from '@/entities/account/api';
export { transactionsApi } from '@/entities/transaction/api';
export { goalsApi } from '@/entities/goal/api';
export { debtsApi } from '@/entities/debt/api';
export { remindersApi } from '@/entities/reminder/api';
