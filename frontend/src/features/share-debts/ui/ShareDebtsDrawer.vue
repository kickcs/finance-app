<script setup lang="ts">
import { computed, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/utils';
import type { SharedDebtsPayload } from '@/entities/debt';
import { useDebtsShare } from '../model/useDebtsShare';

/**
 * Шторка «поделиться долгами человека». Два способа отдать одно и то же:
 * картинкой — она уходит в чат целиком и читается без интернета, и ссылкой —
 * её открывают в браузере, приложение не нужно.
 *
 * Снимок собирается вызывающей стороной и приходит готовым: шторка не должна
 * знать ни про курсы валют, ни про то, какие долги в него попали.
 */
const props = defineProps<{
  modelValue: boolean;
  payload: SharedDebtsPayload | null;
  /** Сколько долгов исключено из снимка как приватные — о них честно говорим. */
  hiddenCount?: number;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { trigger } = useHaptics();
const {
  isSharing,
  isCreatingLink,
  createdUrl,
  linkError,
  resetLink,
  shareAsImage,
  saveAsImage,
  shareAsText,
  createLink,
  copyLink,
  shareLink,
} = useDebtsShare();

const debtsCount = computed(() => props.payload?.debts.length ?? 0);
const isPositive = computed(() => (props.payload?.net ?? 0) >= 0);

const canShareNatively = computed(() => typeof navigator !== 'undefined' && !!navigator.share);

// Каждое открытие — новый снимок, поэтому ссылка от прошлого раза не годится
watch(
  () => props.modelValue,
  (open) => {
    if (open) resetLink();
  },
);

function setOpen(value: boolean) {
  emit('update:modelValue', value);
}

async function onShareImage() {
  if (!props.payload) return;
  trigger('selection');
  await shareAsImage(props.payload);
}

async function onSaveImage() {
  if (!props.payload) return;
  trigger('selection');
  await saveAsImage(props.payload);
}

async function onShareText() {
  if (!props.payload) return;
  trigger('selection');
  await shareAsText(props.payload);
}

async function onCreateLink() {
  if (!props.payload) return;
  trigger('selection');
  await createLink(props.payload);
}

async function onShareLink() {
  if (!props.payload) return;
  await shareLink(props.payload.personName);
}
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    title="Поделиться долгами"
    desktop="dialog"
    @update:model-value="setOpen"
  >
    <div v-if="payload" data-testid="share-debts-drawer" class="space-y-5">
      <!-- Что именно уйдёт получателю -->
      <div
        class="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3.5"
      >
        <p
          class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ payload.personName }}
        </p>
        <p
          :class="
            cn(
              'mt-1 text-h3 font-bold tabular-nums leading-snug break-words',
              isPositive ? 'text-debt-given' : 'text-debt-received',
            )
          "
        >
          {{ isPositive ? '+' : '−' }}{{ formatCurrency(Math.abs(payload.net), payload.currency) }}
        </p>
        <p class="mt-0.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ debtsCount }} {{ pluralize(debtsCount, 'долг', 'долга', 'долгов') }} ·
          {{ isPositive ? 'должен вам' : 'вы должны' }}
        </p>
      </div>

      <!-- Приватные долги в снимок не попадают — говорим об этом до отправки,
           а не после -->
      <p
        v-if="hiddenCount"
        class="flex items-start gap-2 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <UIcon name="visibility_off" size="xs" class="mt-0.5 shrink-0" />
        <span>
          {{ hiddenCount }}
          {{ pluralize(hiddenCount, 'скрытый долг', 'скрытых долга', 'скрытых долгов') }}
          не попадёт ни в картинку, ни в ссылку
        </span>
      </p>

      <!-- Картинкой -->
      <div class="space-y-2">
        <p
          class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Картинкой
        </p>
        <UButton
          variant="secondary"
          full-width
          :loading="isSharing"
          data-testid="share-debts-image-btn"
          @click="canShareNatively ? onShareImage() : onSaveImage()"
        >
          <UIcon :name="canShareNatively ? 'share' : 'download'" size="sm" />
          {{ canShareNatively ? 'Отправить картинку' : 'Сохранить картинку' }}
        </UButton>
        <UButton
          variant="ghost"
          full-width
          :disabled="isSharing"
          data-testid="share-debts-text-btn"
          @click="onShareText"
        >
          <UIcon name="content_copy" size="sm" />
          Скопировать текстом
        </UButton>
      </div>

      <!-- Ссылкой -->
      <div class="space-y-2">
        <p
          class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Ссылкой
        </p>

        <template v-if="createdUrl">
          <div
            class="flex items-center gap-2 px-3 py-3 rounded-xl bg-primary/5 border border-primary/20"
          >
            <UIcon name="link" size="sm" class="text-primary shrink-0" />
            <p class="flex-1 min-w-0 text-body-sm font-medium text-primary truncate select-all">
              {{ createdUrl }}
            </p>
            <button
              type="button"
              aria-label="Копировать ссылку"
              class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition-transform shrink-0"
              @click="copyLink"
            >
              <UIcon name="content_copy" size="sm" />
            </button>
          </div>
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Ссылка показывает долги на момент создания и не обновляется. Открыть её может любой, у
            кого она есть, — приложение не нужно
          </p>
        </template>

        <UButton
          v-else
          variant="secondary"
          full-width
          :loading="isCreatingLink"
          data-testid="share-debts-link-btn"
          @click="onCreateLink"
        >
          <UIcon name="link" size="sm" />
          Создать ссылку
        </UButton>

        <p v-if="linkError" class="flex items-center gap-2 text-body-sm text-danger">
          <UIcon name="error" size="sm" class="shrink-0" />
          {{ linkError }}
        </p>
      </div>
    </div>

    <template v-if="createdUrl" #footer>
      <UButton
        variant="primary"
        full-width
        data-testid="share-debts-send-link"
        @click="onShareLink"
      >
        <UIcon name="share" size="sm" />
        Поделиться ссылкой
      </UButton>
    </template>
  </UOverlay>
</template>
