<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useTmaEntry, TmaLoginForm } from '@/features/tma-auth';
import { UButton, USpinner } from '@/shared/ui';

const { t } = useI18n();
const { state, errorKey, user, start, linkAndGo, submitLogin, switchAccount, webApp } =
  useTmaEntry();

function openSite() {
  webApp.value?.openLink(window.location.origin);
}
</script>

<template>
  <div
    class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <template v-if="state === 'loading'">
      <USpinner />
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        {{ t('features.tmaAuth.loading') }}
      </p>
    </template>

    <template v-else-if="state === 'not-telegram'">
      <h1 class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
        {{ t('features.tmaAuth.notTelegram.title') }}
      </h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        {{ t('features.tmaAuth.notTelegram.description') }}
      </p>
      <UButton variant="secondary" @click="openSite">
        {{ t('features.tmaAuth.notTelegram.openSite') }}
      </UButton>
    </template>

    <template v-else-if="state === 'confirm-link'">
      <h1 class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
        {{ t('features.tmaAuth.confirmLink.title') }}
      </h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        {{ t('features.tmaAuth.confirmLink.description', { email: user?.email ?? '' }) }}
      </p>
      <UButton full-width @click="linkAndGo">
        {{ t('features.tmaAuth.confirmLink.confirm') }}
      </UButton>
      <UButton variant="secondary" full-width @click="switchAccount">
        {{ t('features.tmaAuth.confirmLink.logout') }}
      </UButton>
    </template>

    <template v-else-if="state === 'login'">
      <h1 class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
        {{ t('features.tmaAuth.login.title') }}
      </h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        {{ t('features.tmaAuth.login.description') }}
      </p>
      <TmaLoginForm class="w-full max-w-sm" :submit="submitLogin" />
      <button
        type="button"
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark underline underline-offset-2"
        @click="openSite"
      >
        {{ t('features.tmaAuth.login.noAccount') }}
      </button>
    </template>

    <template v-else>
      <h1 class="text-xl font-bold">😕</h1>
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        {{ t(`features.tmaAuth.${errorKey ?? 'errors.generic'}`) }}
      </p>
      <UButton variant="secondary" @click="start">
        {{ t('features.tmaAuth.errors.retry') }}
      </UButton>
    </template>
  </div>
</template>
