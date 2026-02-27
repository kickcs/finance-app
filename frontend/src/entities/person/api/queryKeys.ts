// Query key factory for people entity
export const personQueryKeys = {
  all: ['people'] as const,
  list: (userId: string) => [...personQueryKeys.all, 'list', userId] as const,
};

export type PersonQueryKeys = typeof personQueryKeys;
