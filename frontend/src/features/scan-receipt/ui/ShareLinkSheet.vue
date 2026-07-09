<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UButton, UIcon, UModal, UToggle, useToast } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useProfile } from '@/shared/api';
import { usePaymentMethods } from '@/entities/payment-method';
import { receiptApi, type SharedReceiptPayload } from '../api/receiptApi';
import { formatChargeDisplay } from '../model/formatCharge';
import type { ParticipantSummary, ReceiptCharge } from '../model/types';

const props = defineProps<{
  open: boolean;
  participantSummaries: ParticipantSummary[];
  charges: ReceiptCharge[];
  storeName: string | null;
  totalAmount: number;
  subtotal: number;
  date: number;
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const { trigger } = useHaptics();
const { toast } = useToast();
const { userId } = useCurrentUser();
const { profile } = useProfile(userId);
const { paymentMethods, createPaymentMethod } = usePaymentMethods(userId);

// Выбранные сохранённые реквизиты
const selectedMethodIds = ref<Set<string>>(new Set());
// Разовые реквизиты этой ссылки (не сохраняются, если галочка выключена)
const customMethods = ref<{ label: string; value: string }[]>([]);

// Форма добавления
const addFormOpen = ref(false);
const newLabel = ref('');
const newValue = ref('');
const saveForFuture = ref(false);

// Создание ссылки
const isCreating = ref(false);
const createdUrl = ref<string | null>(null);
const createError = ref<string | null>(null);

const canShareNative = typeof navigator !== 'undefined' && !!navigator.share;

const participantsCount = computed(() => props.participantSummaries.length);

watch(
  () => props.open,
  (open) => {
    if (open) {
      addFormOpen.value = false;
      newLabel.value = '';
      newValue.value = '';
      saveForFuture.value = false;
      createError.value = null;
    }
  },
);

function toggleMethod(id: string) {
  const next = new Set(selectedMethodIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedMethodIds.value = next;
  trigger('selection');
}

const newMethodValid = computed(
  () => newLabel.value.trim().length > 0 && newValue.value.trim().length > 0,
);

async function addMethod() {
  if (!newMethodValid.value) return;
  const method = { label: newLabel.value.trim(), value: newValue.value.trim() };
  trigger('selection');
  if (saveForFuture.value) {
    try {
      const created = await createPaymentMethod(method);
      selectedMethodIds.value = new Set([...selectedMethodIds.value, created.id]);
    } catch {
      // Сохранить не вышло — реквизиты всё равно уйдут в ссылку разово
      customMethods.value.push(method);
      toast({ title: 'Не удалось сохранить карту', variant: 'error' });
    }
  } else {
    customMethods.value.push(method);
  }
  newLabel.value = '';
  newValue.value = '';
  saveForFuture.value = false;
  addFormOpen.value = false;
}

function removeCustomMethod(index: number) {
  customMethods.value.splice(index, 1);
  trigger('warning');
}

function buildPayload(): SharedReceiptPayload {
  const selected = paymentMethods.value
    .filter((m) => selectedMethodIds.value.has(m.id))
    .map((m) => ({ label: m.label, value: m.value }));

  return {
    storeName: props.storeName,
    date: props.date,
    currency: props.currency,
    totalAmount: props.totalAmount,
    subtotal: props.subtotal,
    charges: props.charges
      .filter((c) => c.enabled)
      .map((c) => ({ label: c.label, display: formatChargeDisplay(c, props.currency) })),
    participants: props.participantSummaries.map((p) => ({
      name: p.name,
      color: p.color,
      isMe: p.isMe,
      total: p.total,
      paidByName: p.paidByName ?? null,
      items: p.items.map((item) => ({
        name: item.name,
        share: item.share,
        sharedWith: item.sharedWith,
        lineTotal: item.lineTotal,
      })),
    })),
    paymentMethods: [...selected, ...customMethods.value],
    ownerName: profile.value?.name ?? null,
  };
}

async function createLink() {
  if (createdUrl.value || isCreating.value) return;
  isCreating.value = true;
  createError.value = null;
  try {
    const { url } = await receiptApi.share(buildPayload());
    createdUrl.value = url;
    trigger('success');
  } catch (error: unknown) {
    createError.value = error instanceof Error ? error.message : 'Не удалось создать ссылку';
    trigger('error');
  } finally {
    isCreating.value = false;
  }
}

async function copyLink() {
  if (!createdUrl.value) return;
  try {
    await navigator.clipboard.writeText(createdUrl.value);
    trigger('success');
    toast({ title: 'Ссылка скопирована' });
  } catch {
    toast({ title: 'Не удалось скопировать', variant: 'error' });
  }
}

async function shareLink() {
  if (!createdUrl.value) return;
  if (canShareNative) {
    try {
      await navigator.share({
        title: props.storeName ? `Чек из ${props.storeName}` : 'Чек',
        url: createdUrl.value,
      });
      return;
    } catch {
      // отменил шаринг — ничего не делаем
      return;
    }
  }
  await copyLink();
}
</script>

<template>
  <UModal
    :model-value="open"
    title="Ссылка на чек"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <!-- Сводка -->
      <div
        class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
      >
        <div class="min-w-0 mr-3">
          <p
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ storeName || 'Чек' }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ participantsCount }}
            {{ pluralize(participantsCount, 'участник', 'участника', 'участников') }} · доли и
            реквизиты по ссылке
          </p>
        </div>
        <span class="text-sm font-bold text-primary tabular-nums shrink-0">
          {{ formatCurrency(totalAmount, currency) }}
        </span>
      </div>

      <!-- Ссылка уже создана -->
      <template v-if="createdUrl">
        <div
          class="flex items-center gap-2 px-3 py-3 rounded-xl bg-primary/5 border border-primary/20"
        >
          <UIcon name="link" size="sm" class="text-primary shrink-0" />
          <p class="flex-1 min-w-0 text-sm font-medium text-primary truncate select-all">
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
          Открыть чек может любой, у кого есть ссылка, — приложение не требуется
        </p>
      </template>

      <!-- Настройка реквизитов (до создания) -->
      <template v-else>
        <div>
          <p
            class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2"
          >
            Куда переводить
          </p>

          <div
            v-if="paymentMethods.length > 0 || customMethods.length > 0"
            class="flex flex-wrap gap-1.5 mb-2"
          >
            <button
              v-for="method in paymentMethods"
              :key="method.id"
              type="button"
              :aria-pressed="selectedMethodIds.has(method.id)"
              :class="
                cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 border',
                  selectedMethodIds.has(method.id)
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark',
                )
              "
              @click="toggleMethod(method.id)"
            >
              <UIcon :name="selectedMethodIds.has(method.id) ? 'check' : 'credit_card'" size="xs" />
              {{ method.label }}
            </button>

            <span
              v-for="(method, index) in customMethods"
              :key="`custom-${index}`"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 border border-primary/30 text-primary"
            >
              {{ method.label }}
              <button
                type="button"
                :aria-label="`Убрать ${method.label}`"
                class="text-primary/60 hover:text-danger transition-colors"
                @click="removeCustomMethod(index)"
              >
                <UIcon name="close" size="xs" />
              </button>
            </span>
          </div>

          <!-- Форма добавления реквизитов -->
          <div v-if="addFormOpen" class="space-y-2">
            <input
              v-model="newLabel"
              type="text"
              placeholder="Название — например, Карта Humo"
              aria-label="Название реквизитов"
              maxlength="50"
              class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
            <input
              v-model="newValue"
              type="text"
              placeholder="Номер карты или телефона"
              aria-label="Номер карты или телефона"
              maxlength="100"
              class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
              @keydown.enter.prevent="addMethod"
            />
            <div class="flex items-center justify-between gap-3 px-0.5">
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  Сохранить для будущих чеков
                </p>
                <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
                  Реквизиты увидят все, у кого есть ссылка
                </p>
              </div>
              <UToggle v-model="saveForFuture" aria-label="Сохранить для будущих чеков" />
            </div>
            <div class="flex gap-2">
              <UButton
                variant="secondary"
                size="md"
                class="flex-1"
                :disabled="!newMethodValid"
                @click="addMethod"
              >
                Добавить
              </UButton>
              <UButton variant="ghost" size="md" @click="addFormOpen = false">Отмена</UButton>
            </div>
          </div>

          <button
            v-else
            type="button"
            class="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-[0.98] transition-all"
            @click="addFormOpen = true"
          >
            <UIcon name="add" size="xs" />
            <span class="text-body-sm font-medium">Добавить реквизиты</span>
          </button>

          <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mt-2">
            Можно и без реквизитов — тогда по ссылке будут только доли
          </p>
        </div>

        <Transition name="section-slide">
          <p v-if="createError" class="text-sm text-danger flex items-center gap-2">
            <UIcon name="error" size="sm" class="flex-shrink-0" />
            {{ createError }}
          </p>
        </Transition>
      </template>
    </div>

    <template #actions>
      <div v-if="createdUrl" class="flex flex-col gap-2 w-full">
        <UButton variant="primary" size="lg" full-width @click="shareLink">
          <UIcon name="share" size="sm" class="mr-2" />
          Поделиться
        </UButton>
      </div>
      <UButton
        v-else
        variant="primary"
        size="lg"
        full-width
        :loading="isCreating"
        @click="createLink"
      >
        <UIcon name="link" size="sm" class="mr-2" />
        Создать ссылку
      </UButton>
    </template>
  </UModal>
</template>

<style>
@import './transitions.css';
</style>
