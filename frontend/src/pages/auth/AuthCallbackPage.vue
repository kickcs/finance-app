<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UCard, UIcon, USpinner } from '@/shared/ui';

const router = useRouter();
const route = useRoute();

const isProcessing = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    // With NestJS backend, OAuth callbacks would be handled differently
    // For now, just check for errors and redirect
    const queryParams = route.query;

    // Check for error in URL params
    const urlError = queryParams.error as string;
    const errorDescription = queryParams.error_description as string;

    if (urlError) {
      throw new Error(errorDescription || urlError);
    }

    // OAuth not implemented in NestJS backend yet
    // Just redirect to login
    error.value = 'OAuth авторизация не поддерживается. Используйте email/пароль.';
  } catch (err) {
    console.error('Auth callback error:', err);
    error.value = err instanceof Error ? err.message : 'Произошла ошибка при авторизации';
  } finally {
    isProcessing.value = false;
  }
});

function goToLogin() {
  router.push({ name: 'login' });
}
</script>

<template>
  <div
    class="min-h-[100dvh] flex items-center justify-center px-6 bg-background-light dark:bg-background-dark"
  >
    <UCard class="p-8 text-center max-w-sm w-full">
      <!-- Processing state -->
      <template v-if="isProcessing">
        <USpinner size="lg" class="mx-auto mb-4" />
        <p class="text-text-secondary-light dark:text-text-secondary-dark">
          Подтверждение аккаунта...
        </p>
      </template>

      <!-- Error state -->
      <template v-else-if="error">
        <div
          class="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4"
        >
          <UIcon name="error" size="xl" class="text-danger" />
        </div>
        <h2 class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
          Ошибка
        </h2>
        <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
          {{ error }}
        </p>
        <button class="text-primary font-medium" @click="goToLogin">Вернуться к входу</button>
      </template>
    </UCard>
  </div>
</template>
