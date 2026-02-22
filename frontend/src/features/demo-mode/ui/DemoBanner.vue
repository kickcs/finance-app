<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { useAuth } from '@/shared/api';

defineProps<{
  formattedRemaining: string;
}>();

const router = useRouter();
const { signOut } = useAuth();

async function handleRegister() {
  // Sign out from demo account and redirect to login
  await signOut();
  router.push({ name: 'login' });
}
</script>

<template>
  <div
    class="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2"
    :style="{ paddingTop: 'calc(0.5rem + var(--safe-area-inset-top))' }"
  >
    <div class="flex items-center justify-between max-w-md mx-auto">
      <div class="flex items-center gap-2">
        <UIcon name="timer" size="sm" class="animate-pulse" />
        <span class="text-sm font-medium">Демо: {{ formattedRemaining }}</span>
      </div>
      <UButton
        variant="ghost"
        size="sm"
        class="!text-white !bg-white/20 hover:!bg-white/30 !border-0"
        @click="handleRegister"
      >
        Зарегистрироваться
      </UButton>
    </div>
  </div>
</template>
