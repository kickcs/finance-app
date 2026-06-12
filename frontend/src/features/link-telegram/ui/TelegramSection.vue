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
  <section>
    <h2
      class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
    >
      Telegram-импорт
    </h2>

    <UCard class="overflow-hidden">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center gap-3.5 px-4 py-4">
        <div class="h-11 w-11 shrink-0 rounded-full bg-surface-light dark:bg-surface-dark animate-shimmer" />
        <div class="flex-1 space-y-2">
          <div class="h-3.5 w-2/3 rounded bg-surface-light dark:bg-surface-dark animate-shimmer" />
          <div class="h-3 w-1/2 rounded bg-surface-light dark:bg-surface-dark animate-shimmer" />
        </div>
      </div>

      <!-- Connected -->
      <template v-else-if="status?.linked">
        <div class="flex items-center gap-3.5 px-4 py-4">
          <span
            class="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
            :style="{ backgroundColor: TELEGRAM_BLUE }"
          >
            <UIcon name="telegram" size="md" />
            <span
              class="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-card-light dark:bg-card-dark"
            >
              <span class="h-2.5 w-2.5 rounded-full bg-success" />
            </span>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {{
                status.telegram_username ? `Подключён как @${status.telegram_username}` : 'Подключён'
              }}
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Пересылай боту уведомления банка — они станут транзакциями.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-danger transition-colors hover:text-danger/80"
            @click="showUnlinkConfirm = true"
          >
            Отвязать
          </button>
        </div>

        <!-- Cards -->
        <div class="border-t border-border-light dark:border-border-dark px-4 py-4">
          <TelegramCardsList />
        </div>
      </template>

      <!-- Waiting for link confirmation -->
      <div v-else-if="waitingForLink" class="px-4 py-5">
        <div class="flex items-start gap-3.5">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-warning/10 text-warning"
          >
            <UIcon name="timer" size="md" />
          </span>
          <div class="flex-1">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Открой бота и нажми «Start»
            </p>
            <p class="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Затем вернись и проверь подключение.
            </p>
          </div>
        </div>
        <div class="mt-4 flex gap-2">
          <UButton variant="primary" size="md" :loading="isChecking" @click="handleCheck">
            Проверить подключение
          </UButton>
          <UButton variant="ghost" size="md" @click="waitingForLink = false"> Отмена </UButton>
        </div>
      </div>

      <!-- Not linked -->
      <div v-else class="px-4 py-5">
        <div class="flex items-start gap-3.5">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
            :style="{ backgroundColor: TELEGRAM_BLUE }"
          >
            <UIcon name="telegram" size="md" />
          </span>
          <div class="flex-1">
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Импорт из Telegram
            </p>
            <p class="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Пересылай уведомления банка нашему боту — они автоматически станут транзакциями.
            </p>
          </div>
        </div>
        <UButton
          variant="primary"
          size="md"
          full-width
          class="mt-4"
          :loading="isConnecting"
          @click="handleConnect"
        >
          <UIcon name="send" size="sm" class="mr-1.5" />
          Подключить Telegram
        </UButton>
      </div>
    </UCard>

    <!-- Unlink confirmation -->
    <ConfirmDeleteModal
      v-model="showUnlinkConfirm"
      title="Отвязать Telegram?"
      warning-text="Бот перестанет импортировать сообщения. Привязки карт сохранятся."
      confirm-label="Отвязать"
      :is-deleting="isUnlinking"
      @confirm="handleUnlink"
    />
  </section>
</template>
