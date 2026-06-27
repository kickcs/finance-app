<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PageContainer, UCard, UIcon } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import { useLocale } from '@/shared/i18n/useLocale';
import { navigateBack } from '@/app/router';
import { useProfile, useAuth } from '@/shared/api';
import type { AppLocale } from '@/shared/i18n';

const { t } = useI18n();
const { user } = useAuth();
const userId = computed(() => user.value?.id ?? null);
const { locale, setLocale } = useLocale();
const { setLanguage } = useProfile(userId);

const options = computed(() => [
  { code: 'ru' as const, label: t('pages.settings.language.russian') },
  { code: 'en' as const, label: t('pages.settings.language.english') },
]);

async function choose(code: AppLocale) {
  // Apply locally first so the UI switches instantly; the profile sync is
  // best-effort (the locale is already persisted in localStorage by setLocale).
  setLocale(code);
  if (userId.value) {
    await setLanguage(code).catch(() => undefined);
  }
}
</script>

<template>
  <PageContainer max-width="2xl" class="relative bg-background-light dark:bg-background-dark">
    <template #header>
      <AppHeader :title="t('pages.settings.language.title')" show-back @back="navigateBack" />
    </template>

    <main class="pt-8 pb-28 md:pb-8">
      <UCard
        variant="bordered"
        class="overflow-hidden divide-y divide-border-light dark:divide-border-dark"
      >
        <button
          v-for="opt in options"
          :key="opt.code"
          type="button"
          :data-testid="`language-option-${opt.code}`"
          class="w-full flex items-center justify-between gap-4 p-4 bg-surface-light dark:bg-surface-dark transition-all hover:bg-border-light dark:hover:bg-border-dark active:bg-border-light dark:active:bg-border-dark"
          @click="choose(opt.code)"
        >
          <span class="font-semibold text-text-primary-light dark:text-text-primary-dark">
            {{ opt.label }}
          </span>
          <div
            :class="[
              'w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0',
              locale === opt.code
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent border-2 border-border-light dark:border-border-dark',
            ]"
          >
            <UIcon v-if="locale === opt.code" name="check" size="sm" />
          </div>
        </button>
      </UCard>
    </main>
  </PageContainer>
</template>
