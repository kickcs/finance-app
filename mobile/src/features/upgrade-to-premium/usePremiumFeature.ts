import { create } from 'zustand';

interface PremiumGateState {
  showUpgradeModal: boolean;
  upgradeFeatureName: string;
  isPremium: boolean;
  setIsPremium: (value: boolean) => void;
  openModal: (featureName: string) => void;
  closeModal: () => void;
}

const usePremiumGateStore = create<PremiumGateState>((set) => ({
  showUpgradeModal: false,
  upgradeFeatureName: '',
  isPremium: false,
  setIsPremium: (value) => set({ isPremium: value }),
  openModal: (featureName) => set({ showUpgradeModal: true, upgradeFeatureName: featureName }),
  closeModal: () => set({ showUpgradeModal: false }),
}));

export function usePremiumFeature() {
  const isPremium = usePremiumGateStore((s) => s.isPremium);
  const openModal = usePremiumGateStore((s) => s.openModal);

  function requirePremium(featureName: string): boolean {
    if (isPremium) return true;
    openModal(featureName);
    return false;
  }

  return { isPremium, requirePremium };
}

export function usePremiumModalState() {
  const showUpgradeModal = usePremiumGateStore((s) => s.showUpgradeModal);
  const upgradeFeatureName = usePremiumGateStore((s) => s.upgradeFeatureName);
  const closeModal = usePremiumGateStore((s) => s.closeModal);
  return { showUpgradeModal, upgradeFeatureName, closeModal };
}

export function setPremiumStatus(isPremium: boolean) {
  usePremiumGateStore.getState().setIsPremium(isPremium);
}
