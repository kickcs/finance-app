<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { usePwaInstall } from '../model/usePwaInstall';
import InstallStep from './InstallStep.vue';

const modelValue = defineModel<boolean>({ required: true });

const { platform, isStandalone, canUseNativePrompt, triggerNativeInstall } =
  usePwaInstall();

async function handleNativeInstall() {
  await triggerNativeInstall();
  modelValue.value = false;
}
</script>

<template>
  <UModal v-model="modelValue" title="Установите Ouro Finance">
    <!-- Already installed -->
    <div v-if="isStandalone" class="flex flex-col items-center gap-3 py-4">
      <div
        class="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center"
      >
        <UIcon name="check_circle" size="lg" class="text-success" />
      </div>
      <p
        class="font-semibold text-text-primary-light dark:text-text-primary-dark"
      >
        Приложение установлено
      </p>
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center"
      >
        Вы уже используете Ouro Finance как приложение
      </p>
    </div>

    <!-- iOS instructions -->
    <div v-else-if="platform === 'ios'" class="space-y-3">
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4"
      >
        Добавьте Ouro Finance на главный экран для быстрого доступа:
      </p>

      <InstallStep :step="1">
        Нажмите
        <UIcon
          name="share"
          size="xs"
          class="inline-block text-primary mx-0.5 align-text-bottom"
        />
        <span class="font-medium">«Поделиться»</span>
      </InstallStep>

      <InstallStep :step="2">
        Выберите
        <span class="font-medium">«На экран Домой»</span>
      </InstallStep>

      <InstallStep :step="3">
        Нажмите
        <span class="font-medium">«Добавить»</span>
      </InstallStep>
    </div>

    <!-- Android with native prompt -->
    <div
      v-else-if="platform === 'android' && canUseNativePrompt"
      class="space-y-4"
    >
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
      >
        Установите Ouro Finance как приложение для быстрого доступа с главного
        экрана.
      </p>
      <UButton variant="primary" full-width @click="handleNativeInstall">
        Установить
      </UButton>
    </div>

    <!-- Android without native prompt -->
    <div v-else-if="platform === 'android'" class="space-y-3">
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4"
      >
        Добавьте Ouro Finance на главный экран:
      </p>

      <InstallStep :step="1">
        Откройте меню
        <span class="font-medium">⋮</span>
        в правом верхнем углу
      </InstallStep>

      <InstallStep :step="2">
        Нажмите
        <span class="font-medium">«Установить приложение»</span>
      </InstallStep>
    </div>

    <!-- Desktop -->
    <div v-else class="space-y-4">
      <p
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
      >
        Установите Ouro Finance как приложение:
      </p>

      <div v-if="canUseNativePrompt">
        <UButton variant="primary" full-width @click="handleNativeInstall">
          Установить
        </UButton>
      </div>

      <div v-else class="space-y-3">
        <InstallStep :step="1"> Откройте меню браузера </InstallStep>

        <InstallStep :step="2">
          Нажмите
          <span class="font-medium">«Установить»</span>
        </InstallStep>
      </div>
    </div>
  </UModal>
</template>
