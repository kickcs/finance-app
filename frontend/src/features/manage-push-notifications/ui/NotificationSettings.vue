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

const PREF_ROWS: Array<{ field: PrefField; title: string }> = [
  { field: 'subscriptionUpcoming', title: 'Предстоящие списания' },
  { field: 'subscriptionCharged', title: 'Успешные авто-списания' },
  { field: 'subscriptionFailed', title: 'Ошибки списания' },
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
  <UCard
    padding="none"
    class="divide-y divide-border-light overflow-hidden dark:divide-border-dark"
  >
    <div class="flex items-center gap-3 px-3.5 py-2.5">
      <span
        class="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-light dark:bg-surface-dark"
      >
        <UIcon
          name="notifications"
          size="xs"
          class="text-text-secondary-light dark:text-text-secondary-dark"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Push-уведомления
        </p>
        <p
          v-if="!isSupported"
          class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Браузер не поддерживает
        </p>
      </div>

      <button
        v-if="isSubscribed"
        type="button"
        class="shrink-0 text-caption font-medium text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
        :disabled="isSendingTest"
        @click="handleTestPush"
      >
        {{ isSendingTest ? 'Отправка...' : 'Тест' }}
      </button>
      <USpinner v-if="isRegistering" size="sm" class="shrink-0" />
      <UToggle
        v-else
        :model-value="isSubscribed"
        :disabled="!isSupported"
        class="shrink-0"
        @update:model-value="handleMasterToggle"
      />
    </div>

    <Transition name="reveal">
      <div v-if="isSubscribed" class="space-y-2 px-3.5 py-2.5">
        <div v-if="isLoadingPrefs" class="flex justify-center py-1">
          <USpinner size="sm" />
        </div>

        <template v-else>
          <div
            v-for="row in PREF_ROWS"
            :key="row.field"
            class="flex items-center justify-between gap-3"
          >
            <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
              {{ row.title }}
            </span>
            <UToggle
              :model-value="preferences?.[row.field] ?? false"
              @update:model-value="(v: boolean) => handlePrefToggle(row.field, v)"
            />
          </div>
        </template>

        <div
          class="flex items-center justify-between gap-3 border-t border-border-light pt-2 dark:border-border-dark"
        >
          <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
            Время напоминаний
          </span>
          <select
            :value="notificationHour"
            class="rounded-lg border border-border-light bg-surface-light px-2 py-1 text-body-sm font-medium text-text-primary-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark"
            @change="handleHourChange"
          >
            <option v-for="h in HOUR_OPTIONS" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </div>
      </div>
    </Transition>

    <div
      v-if="showIosHint"
      class="flex items-start gap-2.5 bg-surface-light px-3.5 py-2.5 dark:bg-surface-dark"
    >
      <UIcon
        name="info"
        size="xs"
        class="mt-0.5 shrink-0 text-text-secondary-light dark:text-text-secondary-dark"
      />
      <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
        Чтобы получать уведомления на iOS, добавьте приложение на главный экран через меню
        «Поделиться».
      </p>
    </div>
  </UCard>
</template>

<style scoped>
.reveal-enter-active,
.reveal-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.reveal-enter-from,
.reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-enter-active,
  .reveal-leave-active {
    transition: none;
  }
}
</style>
