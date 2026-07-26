<script setup lang="ts">
import { ref } from 'vue';
import { UButton, UCard, UIcon, ConfirmDeleteModal, useToast } from '@/shared/ui';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useTelegramLink } from '@/entities/imported-transaction';
import { useHaptics } from '@/shared/lib/haptics';
import TelegramCardsList from './TelegramCardsList.vue';

const { userId } = useCurrentUser();
const { status, isLoading, createLinkToken, unlink, isUnlinking, refetchStatus } =
  useTelegramLink(userId);
const { toast } = useToast();
const { trigger } = useHaptics();

const showUnlinkConfirm = ref(false);
const waitingForLink = ref(false);
const isConnecting = ref(false);
const isChecking = ref(false);

// Telegram brand blue — used only for the brand badge accent (no semantic token exists for it).
const TELEGRAM_BLUE = '#229ED9';

async function handleConnect() {
  isConnecting.value = true;
  try {
    const { deepLink } = await createLinkToken();
    waitingForLink.value = true;
    trigger('selection');
    window.open(deepLink, '_blank');
  } catch {
    toast({ title: 'Не удалось создать ссылку', variant: 'error' });
  } finally {
    isConnecting.value = false;
  }
}

async function handleCheck() {
  isChecking.value = true;
  try {
    await refetchStatus();
    if (status.value?.linked) {
      waitingForLink.value = false;
      trigger('success');
      toast({ title: 'Telegram подключён', variant: 'success' });
    } else {
      trigger('warning');
      toast({
        title: 'Пока не подключено',
        description: 'Открой бота и нажми Start, затем проверь снова.',
        variant: 'default',
      });
    }
  } finally {
    isChecking.value = false;
  }
}

async function handleUnlink() {
  await unlink();
  showUnlinkConfirm.value = false;
  waitingForLink.value = false;
  trigger('success');
  toast({ title: 'Telegram отвязан', variant: 'default' });
}
</script>

<template>
  <UCard padding="none" class="overflow-hidden">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center gap-3 px-3.5 py-3">
      <div
        class="h-9 w-9 shrink-0 animate-shimmer rounded-full bg-surface-light dark:bg-surface-dark"
      />
      <div class="flex-1 space-y-1.5">
        <div class="h-3 w-2/3 animate-shimmer rounded bg-surface-light dark:bg-surface-dark" />
        <div class="h-2.5 w-1/2 animate-shimmer rounded bg-surface-light dark:bg-surface-dark" />
      </div>
    </div>

    <!-- Connected -->
    <template v-else-if="status?.linked">
      <div class="flex items-center gap-3 px-3.5 py-3">
        <span
          class="relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          :style="{ backgroundColor: TELEGRAM_BLUE }"
        >
          <UIcon name="telegram" size="sm" />
          <span
            class="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-card-light dark:bg-card-dark"
          >
            <span class="h-2 w-2 rounded-full bg-success" />
          </span>
        </span>
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            {{
              status.telegram_username ? `Подключён как @${status.telegram_username}` : 'Подключён'
            }}
          </p>
          <p class="truncate text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Пересылай боту уведомления банка
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 text-caption font-medium text-danger transition-colors hover:text-danger/80"
          @click="showUnlinkConfirm = true"
        >
          Отвязать
        </button>
      </div>

      <!-- Cards -->
      <div class="border-t border-border-light px-3.5 py-3 dark:border-border-dark">
        <TelegramCardsList />
      </div>
    </template>

    <!-- Waiting for link confirmation -->
    <div v-else-if="waitingForLink" class="px-3.5 py-3">
      <div class="flex items-center gap-3">
        <span
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/10 text-warning"
        >
          <UIcon name="timer" size="sm" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Открой бота и нажми «Start»
          </p>
          <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
            Затем вернись и проверь подключение.
          </p>
        </div>
      </div>
      <div class="mt-2.5 flex gap-2">
        <UButton variant="primary" size="sm" :loading="isChecking" @click="handleCheck">
          Проверить подключение
        </UButton>
        <UButton variant="ghost" size="sm" @click="waitingForLink = false">Отмена</UButton>
      </div>
    </div>

    <!-- Not linked -->
    <div v-else class="flex items-center gap-3 px-3.5 py-3">
      <span
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
        :style="{ backgroundColor: TELEGRAM_BLUE }"
      >
        <UIcon name="telegram" size="sm" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Импорт из Telegram
        </p>
        <p class="text-caption text-text-secondary-light dark:text-text-secondary-dark">
          Уведомления банка станут транзакциями
        </p>
      </div>
      <UButton
        variant="primary"
        size="sm"
        class="shrink-0"
        :loading="isConnecting"
        @click="handleConnect"
      >
        Подключить
      </UButton>
    </div>

    <!-- Unlink confirmation -->
    <ConfirmDeleteModal
      v-model="showUnlinkConfirm"
      title="Отвязать Telegram?"
      warning-text="Бот перестанет импортировать сообщения. Привязки карт сохранятся."
      confirm-label="Отвязать"
      :is-deleting="isUnlinking"
      @confirm="handleUnlink"
    />
  </UCard>
</template>
