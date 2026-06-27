<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { usePwaInstall } from '../model/usePwaInstall';
import InstallStep from './InstallStep.vue';

const modelValue = defineModel<boolean>({ required: true });

const { platform, isStandalone, canUseNativePrompt, triggerNativeInstall } = usePwaInstall();

async function handleNativeInstall() {
  await triggerNativeInstall();
  modelValue.value = false;
}
</script>

<template>
  <UModal v-model="modelValue" :title="$t('features.installPwa.modalTitle')">
    <!-- Already installed -->
    <div
      v-if="isStandalone"
      data-testid="already-installed"
      class="flex flex-col items-center gap-3 py-4"
    >
      <div class="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
        <UIcon name="check_circle" size="lg" class="text-success" />
      </div>
      <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ $t('features.installPwa.alreadyInstalledTitle') }}
      </p>
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
        {{ $t('features.installPwa.alreadyInstalledDescription') }}
      </p>
    </div>

    <!-- iOS instructions -->
    <div v-else-if="platform === 'ios'" class="space-y-3">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
        {{ $t('features.installPwa.iosInstructions') }}
      </p>

      <InstallStep :step="1">
        {{ $t('features.installPwa.stepTap') }}
        <UIcon name="share" size="xs" class="inline-block text-primary mx-0.5 align-text-bottom" />
        <span class="font-medium">{{ $t('features.installPwa.iosShareButton') }}</span>
      </InstallStep>

      <InstallStep :step="2">
        {{ $t('features.installPwa.stepSelect') }}
        <span class="font-medium">{{ $t('features.installPwa.iosAddToHomeButton') }}</span>
      </InstallStep>

      <InstallStep :step="3">
        {{ $t('features.installPwa.stepTap') }}
        <span class="font-medium">{{ $t('features.installPwa.iosConfirmButton') }}</span>
      </InstallStep>
    </div>

    <!-- Android with native prompt -->
    <div v-else-if="platform === 'android' && canUseNativePrompt" class="space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ $t('features.installPwa.androidNativeDescription') }}
      </p>
      <UButton
        data-testid="android-install-btn"
        variant="primary"
        full-width
        @click="handleNativeInstall"
      >
        {{ $t('features.installPwa.installButton') }}
      </UButton>
    </div>

    <!-- Android without native prompt -->
    <div v-else-if="platform === 'android'" class="space-y-3">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
        {{ $t('features.installPwa.androidManualInstructions') }}
      </p>

      <InstallStep :step="1">
        {{ $t('features.installPwa.stepOpenMenu') }}
        <span class="font-medium">⋮</span>
        {{ $t('features.installPwa.androidMenuHint') }}
      </InstallStep>

      <InstallStep :step="2">
        {{ $t('features.installPwa.stepTap') }}
        <span class="font-medium">{{ $t('features.installPwa.androidInstallMenuItem') }}</span>
      </InstallStep>
    </div>

    <!-- Desktop -->
    <div v-else class="space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ $t('features.installPwa.desktopDescription') }}
      </p>

      <div v-if="canUseNativePrompt">
        <UButton
          data-testid="desktop-install-btn"
          variant="primary"
          full-width
          @click="handleNativeInstall"
        >
          {{ $t('features.installPwa.installButton') }}
        </UButton>
      </div>

      <div v-else class="space-y-3">
        <InstallStep :step="1">{{ $t('features.installPwa.desktopOpenBrowserMenu') }}</InstallStep>

        <InstallStep :step="2">
          {{ $t('features.installPwa.stepTap') }}
          <span class="font-medium">{{ $t('features.installPwa.desktopInstallMenuItem') }}</span>
        </InstallStep>
      </div>
    </div>
  </UModal>
</template>
