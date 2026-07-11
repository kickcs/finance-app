<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { UIcon, USpinner, useToast } from '@/shared/ui';
import { usePushSubscription } from '@/entities/push-subscription';
import { usePwaInstall } from '@/features/install-pwa';

const props = defineProps<{
  transactionCount: number;
}>();

const PUSH_BANNER_MIN_TRANSACTIONS = 7;

const { toast } = useToast();
const {
  isSupported,
  permission,
  isRegistering,
  isSubscribed,
  requestPermission,
  checkExistingSubscription,
} = usePushSubscription();

const isDismissed = useLocalStorage(STORAGE_KEYS.PUSH_BANNER_DISMISSED, false);

// Only one promo banner at a time: while the PWA install banner is visible,
// this one waits its turn.
const { showBanner: pwaBannerVisible } = usePwaInstall();

onMounted(() => {
  if (isDismissed.value) return;
  checkExistingSubscription();
});

const showBanner = computed(
  () =>
    isSupported.value &&
    !isDismissed.value &&
    !isSubscribed.value &&
    !pwaBannerVisible.value &&
    permission.value !== 'denied' &&
    props.transactionCount > PUSH_BANNER_MIN_TRANSACTIONS,
);

async function handleEnable() {
  const success = await requestPermission();
  if (success) {
    toast({ title: 'Push-уведомления включены', variant: 'default' });
  } else if (permission.value === 'denied') {
    toast({
      title: 'Уведомления заблокированы',
      description: 'Разрешите уведомления в настройках браузера',
      variant: 'error',
    });
  }
}

function handleDismiss() {
  isDismissed.value = true;
}
</script>

<template>
  <div
    v-if="showBanner"
    data-testid="push-notification-banner"
    class="flex items-center gap-3 rounded-xl bg-primary/5 dark:bg-primary/10 px-3 py-2.5"
  >
    <div
      class="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0"
    >
      <UIcon name="notifications" size="sm" class="text-primary" />
    </div>

    <div class="flex-1 min-w-0">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Включите push-уведомления
      </p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        Можно выключить в настройках профиля
      </p>
    </div>

    <button
      class="text-xs font-semibold text-primary hover:text-primary-hover transition-colors whitespace-nowrap shrink-0"
      :disabled="isRegistering"
      @click="handleEnable"
    >
      <USpinner v-if="isRegistering" size="sm" />
      <span v-else>Включить</span>
    </button>

    <button
      data-testid="push-banner-dismiss"
      aria-label="Скрыть баннер уведомлений"
      class="p-1 rounded-md text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors shrink-0"
      @click="handleDismiss"
    >
      <UIcon name="close" size="xs" />
    </button>
  </div>
</template>
