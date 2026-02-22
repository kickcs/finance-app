import { ref } from 'vue';
import { useSubscription } from '@/entities/subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const showUpgradeModal = ref(false);
const upgradeFeatureName = ref('');

export function usePremiumFeature() {
  const { userId } = useCurrentUser();
  const { isPremium, subscription } = useSubscription(userId);

  function requirePremium(featureName: string): boolean {
    if (isPremium.value) return true;
    upgradeFeatureName.value = featureName;
    showUpgradeModal.value = true;
    return false;
  }

  return { isPremium, subscription, showUpgradeModal, upgradeFeatureName, requirePremium };
}
