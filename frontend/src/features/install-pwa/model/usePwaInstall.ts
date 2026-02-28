import { ref, computed } from 'vue';
import { useMediaQuery, useLocalStorage, useEventListener } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const isStandaloneMedia = useMediaQuery('(display-mode: standalone)');

function isRunningStandalone(): boolean {
  return isStandaloneMedia.value || (navigator as any).standalone === true;
}

// Module-level state — shared across all usePwaInstall() calls
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const canUseNativePrompt = ref(false);
const showModal = ref(false);
const isDismissed = useLocalStorage(STORAGE_KEYS.PWA_INSTALL_DISMISSED, false);

useEventListener(window, 'beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  canUseNativePrompt.value = true;
});

export function usePwaInstall() {
  const platform = detectPlatform();
  const isStandalone = isRunningStandalone();

  const showBanner = computed(() => !isStandalone && !isDismissed.value);

  function openModal() {
    showModal.value = true;
  }

  function closeModal() {
    showModal.value = false;
  }

  function dismissBanner() {
    isDismissed.value = true;
  }

  async function triggerNativeInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      dismissBanner();
    }
    deferredPrompt = null;
    canUseNativePrompt.value = false;
  }

  return {
    platform,
    isStandalone,
    isDismissed,
    showModal,
    showBanner,
    canUseNativePrompt,
    openModal,
    closeModal,
    dismissBanner,
    triggerNativeInstall,
  };
}
