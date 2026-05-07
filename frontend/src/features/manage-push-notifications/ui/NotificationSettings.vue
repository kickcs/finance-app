<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { UCard, UToggle, UIcon, USpinner, useToast } from '@/shared/ui';
import {
  usePushSubscription,
  useNotificationPreferences,
  pushSubscriptionApi,
} from '@/entities/push-subscription';
import { usePwaInstall } from '@/features/install-pwa';
import { useProfile } from '@/shared/api/composables/useProfile';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const DEFAULT_NOTIFICATION_HOUR = 12;
const HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 6);

type PrefField = 'subscriptionUpcoming' | 'subscriptionCharged' | 'subscriptionFailed';

const PREF_ROWS: Array<{ field: PrefField; title: string; description: string }> = [
  {
    field: 'subscriptionUpcoming',
    title: 'Предстоящие списания',
    description: 'Напомним за несколько дней до списания подписки',
  },
  {
    field: 'subscriptionCharged',
    title: 'Успешные авто-списания',
    description: 'Уведомление о выполненном авто-списании',
  },
  {
    field: 'subscriptionFailed',
    title: 'Ошибки списания',
    description: 'Если авто-списание не удалось',
  },
];

const {
  isSupported,
  permission,
  isRegistering,
  isSubscribed,
  requestPermission,
  checkExistingSubscription,
  unsubscribe,
} = usePushSubscription();

const {
  preferences,
  isLoading: isLoadingPrefs,
  update: updatePrefs,
} = useNotificationPreferences();

const { userId } = useCurrentUser();
const { profile, updateProfile } = useProfile(userId);

const { platform, isStandalone } = usePwaInstall();

const { toast } = useToast();
const isSendingTest = ref(false);

onMounted(() => checkExistingSubscription());

const showIosHint = computed(() => platform === 'ios' && !isStandalone && !isSubscribed.value);

async function handleMasterToggle(value: boolean) {
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

function handlePrefToggle(field: PrefField, value: boolean) {
  updatePrefs({ [field]: value });
}

const notificationHour = computed(
  () => profile.value?.notification_hour ?? DEFAULT_NOTIFICATION_HOUR,
);

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

async function handleHourChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = Number(target.value);
  try {
    await updateProfile({ notification_hour: value });
    toast({ title: 'Время уведомлений обновлено', variant: 'default' });
  } catch {
    toast({ title: 'Не удалось сохранить', variant: 'error' });
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
  <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
    <div class="flex items-center justify-between gap-3.5 px-4 py-3.5">
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
            <template v-else>Получайте напоминания о подписках</template>
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
          @update:model-value="handleMasterToggle"
        />
      </div>
    </div>

    <div class="px-4 py-3.5 space-y-4" :class="{ 'opacity-50 pointer-events-none': !isSubscribed }">
      <p class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
        Типы уведомлений
      </p>

      <div v-if="isLoadingPrefs" class="flex justify-center py-2">
        <USpinner size="sm" />
      </div>

      <template v-else>
        <div
          v-for="row in PREF_ROWS"
          :key="row.field"
          class="flex items-center justify-between gap-4"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ row.title }}
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
              {{ row.description }}
            </p>
          </div>
          <UToggle
            :model-value="preferences?.[row.field] ?? false"
            :disabled="!isSubscribed"
            @update:model-value="(v: boolean) => handlePrefToggle(row.field, v)"
          />
        </div>
      </template>
    </div>

    <div
      class="flex items-center justify-between gap-4 px-4 py-3.5"
      :class="{ 'opacity-50 pointer-events-none': !isSubscribed }"
    >
      <div class="min-w-0">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Время уведомлений
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
          В какое время отправлять напоминания
        </p>
      </div>
      <select
        :value="notificationHour"
        :disabled="!isSubscribed"
        class="text-sm font-medium bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-light dark:border-border-dark rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        @change="handleHourChange"
      >
        <option v-for="h in HOUR_OPTIONS" :key="h" :value="h">{{ formatHour(h) }}</option>
      </select>
    </div>

    <div
      v-if="showIosHint"
      class="flex items-start gap-3 px-4 py-3.5 bg-surface-light dark:bg-surface-dark"
    >
      <UIcon
        name="info"
        size="sm"
        class="text-text-secondary-light dark:text-text-secondary-dark shrink-0 mt-0.5"
      />
      <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
        Чтобы получать уведомления на iOS, добавьте приложение на главный экран через меню
        «Поделиться».
      </p>
    </div>
  </UCard>
</template>
