import { ref, computed } from 'vue';

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

function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

const DISMISS_KEY = 'pwa-install-dismissed';

// Module-level state — shared across all usePwaInstall() calls
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const canUseNativePrompt = ref(false);
const showModal = ref(false);
const isDismissed = ref(localStorage.getItem(DISMISS_KEY) === 'true');

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    canUseNativePrompt.value = true;
  });
}

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
    localStorage.setItem(DISMISS_KEY, 'true');
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
