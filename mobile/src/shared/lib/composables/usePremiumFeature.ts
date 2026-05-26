import { create } from 'zustand';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useSubscription } from '@/entities/subscription/api/useSubscription';

type UpgradeRequest = { featureName: string } | null;

interface PremiumState {
  upgradeFor: UpgradeRequest;
  request: (featureName: string) => void;
  dismiss: () => void;
}

const usePremiumStore = create<PremiumState>((set) => ({
  upgradeFor: null,
  request: (featureName) => set({ upgradeFor: { featureName } }),
  dismiss: () => set({ upgradeFor: null }),
}));

/**
 * Gate for premium-only features.
 *
 * `useSubscription` returns `{ isPremium, ... }` directly (derived from
 * `subscription.is_premium` inside the hook), so we destructure it without
 * going through `.data`.
 */
export function usePremiumFeature() {
  const user = useAuthStore((s) => s.user);
  const { isPremium } = useSubscription(user?.id ?? null);
  const request = usePremiumStore((s) => s.request);

  const requirePremium = (featureName: string): boolean => {
    if (isPremium) return true;
    request(featureName);
    return false;
  };

  return { isPremium, requirePremium };
}

/** Read-only access to the current upgrade request (for the modal listener). */
export function useUpgradeRequest(): UpgradeRequest {
  return usePremiumStore((s) => s.upgradeFor);
}

/** Returns the dismiss action (for the modal to call on close). */
export function useDismissUpgrade(): () => void {
  return usePremiumStore((s) => s.dismiss);
}
