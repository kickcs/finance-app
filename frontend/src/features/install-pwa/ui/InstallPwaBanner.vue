<script setup lang="ts">
import { UCard, UIcon } from '@/shared/ui';
import { usePwaInstall } from '../model/usePwaInstall';

const emit = defineEmits<{
  install: [];
}>();

const { showBanner, dismissBanner } = usePwaInstall();

function handleClick() {
  emit('install');
}

function handleDismiss(e: Event) {
  e.stopPropagation();
  dismissBanner();
}
</script>

<template>
  <div v-if="showBanner" data-testid="install-pwa-banner">
    <UCard
      data-testid="install-pwa-card"
      clickable
      class="cursor-pointer border border-primary/20 dark:border-primary/30 bg-gradient-to-r from-primary/5 to-transparent dark:from-primary/10"
      @click="handleClick"
    >
      <div class="flex items-center gap-4 p-4">
        <!-- Icon -->
        <div class="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <UIcon name="phone_iphone" size="md" class="text-white" />
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
            Установите приложение
          </p>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Быстрый доступ с главного экрана
          </p>
        </div>

        <!-- Dismiss -->
        <button
          data-testid="dismiss-btn"
          class="p-1.5 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors shrink-0"
          @click="handleDismiss"
        >
          <UIcon name="close" size="sm" />
        </button>
      </div>
    </UCard>
  </div>
</template>
