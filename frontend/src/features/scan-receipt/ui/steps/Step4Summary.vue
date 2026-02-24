<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { UButton, UIcon, UInput } from '@/shared/ui';
import { AccountSelector } from '@/entities/account';
import { CategoryChips, EXPENSE_CATEGORIES } from '@/entities/category';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { haptics } from '@/shared/lib/haptics';
import type { ParticipantSummary, ScanReceiptFormData } from '../../model/types';
import type { AccountWithBalances } from '@/entities/account';
import { useReceiptShare, type ReceiptShareData } from '../../model/useReceiptShare';
import PersonSummaryCard from '../PersonSummaryCard.vue';

const props = defineProps<{
  participantSummaries: ParticipantSummary[];
  currency: string;
  formData: ScanReceiptFormData;
  accounts: AccountWithBalances[];
  subtotal: number;
  serviceChargePercent: number | null;
  serviceChargeAmount: number;
  totalAmount: number;
  storeName: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  isSuccess: boolean;
  isFormValid: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: ScanReceiptFormData];
  submit: [];
  back: [];
}>();

const router = useRouter();

// Calendar / date picker
const calendarOpen = ref(false);

const calendarValue = computed(() => {
  const d = new Date(props.formData.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

const displayDate = computed(() => {
  const d = new Date(props.formData.date);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
});

function onDateSelect(value: DateValue | undefined) {
  if (!value) return;
  const date = new Date(value.year, value.month - 1, value.day);
  emit('update:formData', {
    ...props.formData,
    date: date.getTime(),
  });
  calendarOpen.value = false;
}

// Create debts toggle
const createDebts = computed({
  get: () => props.formData.createDebts,
  set: (val: boolean) => {
    emit('update:formData', { ...props.formData, createDebts: val });
  },
});

// Debt count = non-me participants with items
const debtCount = computed(() =>
  props.participantSummaries.filter((p) => !p.isMe && p.itemCount > 0).length,
);

function handleSubmit() {
  haptics.tap();
  emit('submit');
}

// Sharing
const { isSharing, shareAsImage, shareAsText, saveToGallery } = useReceiptShare();

const shareActions = computed(() => [
  { icon: 'photo_camera', label: 'Картинкой', action: () => shareAsImage(shareData.value) },
  { icon: 'share', label: 'Текстом', action: () => shareAsText(shareData.value) },
  { icon: 'download', label: 'Сохранить', action: () => saveToGallery(shareData.value) },
]);

const shareData = computed<ReceiptShareData>(() => ({
  storeName: props.storeName,
  date: props.formData.date,
  currency: props.currency,
  totalAmount: props.totalAmount,
  subtotal: props.subtotal,
  serviceChargePercent: props.serviceChargePercent,
  serviceChargeAmount: props.serviceChargeAmount,
  participants: props.participantSummaries,
}));
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- Success overlay -->
    <Transition name="fade">
      <div
        v-if="isSuccess"
        class="fixed inset-0 z-50 flex flex-col items-center
               bg-background-light dark:bg-background-dark
               px-6 pt-[var(--safe-area-inset-top)] pb-[calc(2rem+var(--safe-area-inset-bottom))]"
        aria-live="assertive"
      >
        <!-- Centered content group -->
        <div class="flex-1 flex flex-col items-center justify-center w-full max-w-xs">
          <!-- Checkmark + message -->
          <div class="flex flex-col items-center gap-3 success-hero">
            <div class="w-20 h-20 rounded-full bg-success/12 flex items-center justify-center success-icon">
              <UIcon name="check_circle" size="2xl" class="text-success" />
            </div>
            <div class="text-center">
              <h2 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-1">
                Готово!
              </h2>
              <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Создана транзакция на {{ formatCurrency(totalAmount, currency) }}
                <template v-if="createDebts && debtCount > 0">
                  <br />и {{ debtCount }} {{ pluralize(debtCount, 'долг', 'долга', 'долгов') }}
                </template>
              </p>
            </div>
          </div>

          <!-- Share actions -->
          <div class="w-full mt-10 space-y-3 success-actions">
            <p class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark text-center uppercase tracking-wide">
              Поделиться
            </p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="btn in shareActions"
                :key="btn.icon"
                type="button"
                :disabled="isSharing"
                class="flex flex-col items-center gap-2 p-3 rounded-2xl
                       bg-card-light dark:bg-card-dark
                       border border-border-light dark:border-border-dark
                       active:scale-95 transition-all duration-150
                       disabled:opacity-50"
                @click="btn.action"
              >
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UIcon :name="btn.icon" size="sm" class="text-primary" />
                </div>
                <span class="text-[11px] font-medium text-text-secondary-light dark:text-text-secondary-dark leading-tight">
                  {{ btn.label }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Done button pinned at bottom -->
        <div class="w-full max-w-xs flex-shrink-0 pt-4 success-done">
          <UButton
            variant="primary"
            size="xl"
            full-width
            @click="router.push('/')"
          >
            На главную
          </UButton>
        </div>
      </div>
    </Transition>

    <!-- Scrollable content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-4"
      :class="isSubmitting && 'opacity-50 pointer-events-none'"
    >

      <!-- Total summary card -->
      <div class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark">
        <template v-if="serviceChargePercent && serviceChargeAmount > 0">
          <div class="flex justify-between items-baseline mb-1">
            <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              Подытог
            </span>
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
              {{ formatCurrency(subtotal, currency) }}
            </span>
          </div>
          <div class="flex justify-between items-baseline mb-2">
            <span class="text-xs text-primary font-medium">
              Обслуживание {{ serviceChargePercent }}%
            </span>
            <span class="text-sm text-primary tabular-nums font-medium">
              +{{ formatCurrency(serviceChargeAmount, currency) }}
            </span>
          </div>
          <div class="h-px bg-border-light dark:bg-border-dark mb-2" />
        </template>
        <div class="flex justify-between items-baseline">
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Сумма чека
          </span>
          <span class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
            {{ formatCurrency(totalAmount, currency) }}
          </span>
        </div>
      </div>

      <!-- Per-person breakdown -->
      <section aria-label="Разбивка по участникам">
        <h2 class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2.5">
          Кто сколько
        </h2>
        <div class="space-y-2">
          <PersonSummaryCard
            v-for="p in participantSummaries"
            :key="p.id"
            :participant="p"
            :currency="currency"
          />
        </div>
      </section>

      <!-- Divider -->
      <div class="h-px bg-border-light dark:bg-border-dark" />

      <!-- Transaction parameters -->
      <section aria-label="Параметры транзакции" class="space-y-3">
        <h2 class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide">
          Параметры
        </h2>

        <!-- Account -->
        <AccountSelector
          :accounts="accounts"
          :selected-id="formData.accountId"
          label="Счёт"
          @select="$emit('update:formData', { ...formData, accountId: $event })"
        />

        <!-- Category -->
        <CategoryChips
          :categories="EXPENSE_CATEGORIES"
          :selected-id="formData.categoryId"
          label="Категория"
          @select="$emit('update:formData', { ...formData, categoryId: $event })"
        />

        <!-- Description + Date -->
        <div class="grid grid-cols-2 gap-2">
          <UInput
            :model-value="formData.description"
            label="Комментарий"
            placeholder="#кафе..."
            @update:model-value="$emit('update:formData', { ...formData, description: $event as string })"
          />

          <div class="flex flex-col gap-1.5 w-full">
            <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark ml-0.5">
              Дата
            </label>
            <Popover v-model:open="calendarOpen">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  class="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm
                         bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark
                         text-text-primary-light dark:text-text-primary-dark transition-all duration-150"
                >
                  <span>{{ displayDate }}</span>
                  <UIcon
                    name="calendar_today"
                    size="sm"
                    class="text-text-tertiary-light dark:text-text-tertiary-dark"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="top" :side-offset="8" class="w-auto p-0">
                <Calendar
                  :model-value="calendarValue"
                  locale="ru-RU"
                  @update:model-value="onDateSelect"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <!-- Create debts toggle -->
        <button
          type="button"
          role="switch"
          :aria-checked="createDebts"
          class="flex items-center justify-between w-full px-4 py-3 rounded-xl
                 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark
                 transition-all"
          :class="createDebts && 'border-primary/30 bg-primary/[0.03]'"
          @click="createDebts = !createDebts"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              :class="createDebts
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark'"
            >
              <UIcon name="group" size="sm" />
            </div>
            <div class="text-left">
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Создать долги
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ debtCount }} {{ pluralize(debtCount, 'участник', 'участника', 'участников') }} должны вам
              </p>
            </div>
          </div>
          <!-- Toggle -->
          <div
            class="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
            :class="createDebts ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
          >
            <div
              class="absolute w-4.5 h-4.5 bg-white rounded-full top-[3px] shadow-xs transition-all"
              :class="createDebts ? 'right-[3px]' : 'left-[3px]'"
            />
          </div>
        </button>

        <!-- What will be created -->
        <div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-light dark:bg-surface-dark">
          <UIcon name="receipt_long" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0" />
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark flex-1">
            Будет создана 1 транзакция
            <template v-if="createDebts && debtCount > 0">
              и {{ debtCount }} {{ pluralize(debtCount, 'долг', 'долга', 'долгов') }}
            </template>
          </span>
        </div>

      </section>

    </div>

    <!-- Sticky footer -->
    <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark">

      <Transition name="section-slide">
        <p v-if="submitError" class="text-sm text-danger mb-3 flex items-center gap-2">
          <UIcon name="error" size="sm" class="flex-shrink-0" />
          {{ submitError }}
        </p>
      </Transition>

      <UButton
        variant="primary"
        size="xl"
        full-width
        :loading="isSubmitting"
        :disabled="!isFormValid"
        @click="handleSubmit"
      >
        <UIcon name="check" size="sm" class="mr-2" />
        Создать
      </UButton>
    </div>

  </div>
</template>

<style>
@import '../transitions.css';
</style>

<style scoped>
/* Success overlay staggered animations */
.success-icon {
  animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
}

.success-hero {
  animation: fadeSlideUp 0.4s ease-out 0.05s both;
}

.success-actions {
  animation: fadeSlideUp 0.35s ease-out 0.35s both;
}

.success-done {
  animation: fadeSlideUp 0.3s ease-out 0.55s both;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeSlideUp {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
