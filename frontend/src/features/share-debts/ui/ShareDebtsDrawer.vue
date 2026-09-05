<script setup lang="ts">
import { computed, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton, UIcon, UInput, UToggle } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatCardNumber } from '@/shared/lib/format/cardNumber';
import { useCardNumberInput } from '@/shared/lib/hooks/useCardNumberInput';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import { cn } from '@/shared/lib/utils';
import type { SharedDebtsPayload } from '@/entities/debt';
import { useDebtsShare } from '../model/useDebtsShare';
import { useShareCardNumber } from '../model/useShareCardNumber';

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

const { userId } = useCurrentUser();
const {
  savedCard,
  attachedCard,
  isAttached: isCardAttached,
  isEditing: isEditingCard,
  draft: cardDraft,
  isDraftValid: isCardDraftValid,
  isSaving: isSavingCard,
  saveError: cardSaveError,
  startEdit: startCardEdit,
  cancelEdit: cancelCardEdit,
  saveCard,
  reset: resetCard,
} = useShareCardNumber(userId);

/**
 * Снимок приходит готовым, но карту к нему прикладывает именно шторка: она
 * одна знает, оставил её пользователь приложенной или снял перед отправкой.
 */
const sharedPayload = computed<SharedDebtsPayload | null>(() =>
  props.payload ? { ...props.payload, cardNumber: attachedCard.value } : null,
);

/** В поле номер читается по четыре цифры, в модели лежит голыми. */
const { view: cardDraftView, onInput: onCardDraftInput } = useCardNumberInput(cardDraft);

const debtsCount = computed(() => props.payload?.debts.length ?? 0);
const isPositive = computed(() => (props.payload?.net ?? 0) >= 0);

const canShareNatively = computed(() => typeof navigator !== 'undefined' && !!navigator.share);

// Каждое открытие — новый снимок, поэтому ссылка от прошлого раза не годится
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetLink();
      resetCard();
    }
  },
);

// Ссылка хранит снимок целиком: сняли или поменяли карту — старая ссылка
// показывала бы уже не то, что на экране, поэтому её пересоздают
watch(attachedCard, () => {
  if (createdUrl.value) resetLink();
});

function setOpen(value: boolean) {
  emit('update:modelValue', value);
}

async function onShareImage() {
  if (!sharedPayload.value) return;
  trigger('selection');
  await shareAsImage(sharedPayload.value);
}

async function onSaveImage() {
  if (!sharedPayload.value) return;
  trigger('selection');
  await saveAsImage(sharedPayload.value);
}

async function onShareText() {
  if (!sharedPayload.value) return;
  trigger('selection');
  await shareAsText(sharedPayload.value);
}

async function onCreateLink() {
  if (!sharedPayload.value) return;
  trigger('selection');
  await createLink(sharedPayload.value);
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

      <!-- Куда переводить: карта живёт в профиле, но приложить её к этому
           снимку — отдельное решение -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <p
            class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Карта для перевода
          </p>
          <UToggle
            v-if="savedCard && !isEditingCard"
            v-model="isCardAttached"
            :disabled="isCreatingLink"
            data-testid="share-debts-card-toggle"
          />
        </div>

        <template v-if="isEditingCard">
          <UInput
            :model-value="cardDraftView"
            type="tel"
            icon="credit_card"
            placeholder="0000 0000 0000 0000"
            data-testid="share-debts-card-input"
            @update:model-value="onCardDraftInput"
          />
          <div class="flex gap-2">
            <UButton variant="ghost" full-width :disabled="isSavingCard" @click="cancelCardEdit">
              Отмена
            </UButton>
            <UButton
              variant="secondary"
              full-width
              :loading="isSavingCard"
              :disabled="!isCardDraftValid"
              data-testid="share-debts-card-save"
              @click="saveCard"
            >
              Сохранить
            </UButton>
          </div>
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Номер сохранится в профиле — в следующий раз подставим его сами
          </p>
        </template>

        <template v-else-if="savedCard">
          <div
            :class="
              cn(
                'flex items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-3 transition-opacity',
                !isCardAttached && 'opacity-45',
              )
            "
          >
            <UIcon
              name="credit_card"
              size="sm"
              class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
            />
            <p
              class="flex-1 min-w-0 truncate text-body-sm font-semibold tabular-nums tracking-wide text-text-primary-light dark:text-text-primary-dark select-all"
            >
              {{ formatCardNumber(savedCard) }}
            </p>
            <button
              type="button"
              aria-label="Изменить номер карты"
              class="w-9 h-9 rounded-lg bg-surface-light dark:bg-card-dark flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark active:scale-90 transition-transform shrink-0"
              data-testid="share-debts-card-edit"
              @click="startCardEdit"
            >
              <UIcon name="edit" size="sm" />
            </button>
          </div>
          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            {{
              isCardAttached
                ? 'Номер увидит каждый, у кого есть картинка или ссылка'
                : 'Карта не попадёт ни в картинку, ни в ссылку'
            }}
          </p>
        </template>

        <UButton
          v-else
          variant="ghost"
          full-width
          data-testid="share-debts-card-add"
          @click="startCardEdit"
        >
          <UIcon name="add" size="sm" />
          Добавить карту
        </UButton>

        <p v-if="cardSaveError" class="flex items-center gap-2 text-body-sm text-danger">
          <UIcon name="error" size="sm" class="shrink-0" />
          {{ cardSaveError }}
        </p>
      </div>

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
