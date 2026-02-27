import { ref, type Ref, type ComputedRef } from 'vue';
import type { SubscriptionStatus } from '@/entities/subscription';

const showUpgradeModal = ref(false);
const upgradeFeatureName = ref('');

// Singleton refs set by the component that calls init()
let isPremiumRef: ComputedRef<boolean> | null = null;
let subscriptionRef: Ref<SubscriptionStatus> | ComputedRef<SubscriptionStatus> | null = null;

/**
 * Must be called inside setup() context (e.g. in App.vue) to initialize
 * the subscription-aware refs. Other callers get only modal controls.
 */
export function usePremiumFeature() {
  function init(deps: {
    isPremium: ComputedRef<boolean>;
    subscription: Ref<SubscriptionStatus> | ComputedRef<SubscriptionStatus>;
  }) {
    isPremiumRef = deps.isPremium;
    subscriptionRef = deps.subscription;
  }

  function requirePremium(featureName: string): boolean {
    if (isPremiumRef?.value) return true;
    upgradeFeatureName.value = featureName;
    showUpgradeModal.value = true;
    return false;
  }

  return {
    showUpgradeModal,
    upgradeFeatureName,
    requirePremium,
    init,
    get isPremium() {
      return isPremiumRef?.value ?? false;
    },
    get subscription() {
      return subscriptionRef?.value ?? null;
    },
  };
}
