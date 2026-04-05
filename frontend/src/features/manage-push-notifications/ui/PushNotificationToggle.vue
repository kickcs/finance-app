<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { UToggle, UIcon, USpinner, useToast } from '@/shared/ui';
import { usePushSubscription, pushSubscriptionApi } from '@/entities/push-subscription';

const {
  isSupported,
  permission,
  isRegistering,
  isSubscribed,
  requestPermission,
  checkExistingSubscription,
  unsubscribe,
} = usePushSubscription();
const { toast } = useToast();
const isSendingTest = ref(false);

onMounted(() => checkExistingSubscription());

async function handleToggle(value: boolean) {
  if (value) {
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
  } else {
    await unsubscribe();
    toast({ title: 'Push-уведомления отключены', variant: 'default' });
  }
}

async function handleTestPush() {
  try {
    isSendingTest.value = true;
    await pushSubscriptionApi.sendTest();
    toast({ title: 'Тестовое уведомление отправлено', variant: 'default' });
  } catch {
    toast({ title: 'Не удалось отправить', variant: 'error' });
  } finally {
    isSendingTest.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-3.5">
    <div class="flex items-center gap-3.5 min-w-0">
      <UIcon
        name="notifications"
        size="sm"
        class="text-text-secondary-light dark:text-text-secondary-dark shrink-0"
      />
      <div class="min-w-0">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Push-уведомления
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          <template v-if="!isSupported">Не поддерживается</template>
          <template v-else>Уведомления о предстоящих списаниях</template>
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button
        v-if="isSubscribed"
        class="text-xs font-medium text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
        :disabled="isSendingTest"
        @click="handleTestPush"
      >
        {{ isSendingTest ? 'Отправка...' : 'Тест' }}
      </button>
      <USpinner v-if="isRegistering" size="sm" />
      <UToggle
        v-else
        :model-value="isSubscribed"
        :disabled="!isSupported"
        @update:model-value="handleToggle"
      />
    </div>
  </div>
</template>
