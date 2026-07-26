// Profile keys stay here (profile is in shared; entity keys live in @/entities/*)
export const profileQueryKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileQueryKeys.all, userId] as const,
};

export const queryKeys = {
  profile: profileQueryKeys,
} as const;
