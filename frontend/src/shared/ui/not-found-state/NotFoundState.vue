<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UIcon } from '@/shared/ui/icon';
import { UButton } from '@/shared/ui/button';

withDefaults(
  defineProps<{
    message?: string;
    icon?: string;
    actionLabel?: string;
    actionRoute?: string;
  }>(),
  {
    message: 'Не найдено',
    icon: 'error',
    actionLabel: 'На главную',
    actionRoute: 'dashboard',
  },
);

const router = useRouter();
</script>

<template>
  <div class="text-center py-12">
    <div
      class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
    >
      <UIcon
        :name="icon"
        size="xl"
        class="text-text-tertiary-light dark:text-text-tertiary-dark"
      />
    </div>
    <p class="text-text-secondary-light dark:text-text-secondary-dark mb-4">
      {{ message }}
    </p>
    <UButton variant="primary" @click="router.push({ name: actionRoute })">
      {{ actionLabel }}
    </UButton>
  </div>
</template>
