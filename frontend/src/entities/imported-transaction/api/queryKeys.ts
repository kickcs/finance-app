export const importedTransactionQueryKeys = {
  all: ['imported-transactions'] as const,
  inbox: (userId: string) => [...importedTransactionQueryKeys.all, 'inbox', userId] as const,
  link: (userId: string) => [...importedTransactionQueryKeys.all, 'link', userId] as const,
  cards: (userId: string) => [...importedTransactionQueryKeys.all, 'cards', userId] as const,
};

export type ImportedTransactionQueryKeys = typeof importedTransactionQueryKeys;
