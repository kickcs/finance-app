<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { UButton, UInput } from '@/shared/ui';

const props = defineProps<{ submit: (email: string, password: string) => Promise<void> }>();

const { t } = useI18n();
const email = ref('');
const password = ref('');
const pending = ref(false);
const failed = ref(false);

async function onSubmit() {
  if (!email.value || !password.value || pending.value) return;
  pending.value = true;
  failed.value = false;
  try {
    await props.submit(email.value, password.value);
  } catch {
    failed.value = true;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
    <UInput
      v-model="email"
      type="email"
      autocomplete="email"
      :placeholder="t('features.tmaAuth.login.email')"
    />
    <UInput
      v-model="password"
      type="password"
      autocomplete="current-password"
      :placeholder="t('features.tmaAuth.login.password')"
    />
    <p v-if="failed" class="text-sm text-danger">{{ t('features.tmaAuth.login.error') }}</p>
    <UButton type="submit" :loading="pending" full-width>
      {{ t('features.tmaAuth.login.submit') }}
    </UButton>
  </form>
</template>
