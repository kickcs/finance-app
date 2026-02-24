<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon, UBadge, UInput } from '@/shared/ui';
import { AccountSelector } from '@/entities/account';
import { CategoryChips } from '@/entities/category';
import { EXPENSE_CATEGORIES } from '@/entities/category';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { formatCurrency } from '@/shared/lib/format/currency';
import { haptics } from '@/shared/lib/haptics';
import type { ParticipantSummary, ScanReceiptFormData } from '../../model/types';
import type { AccountWithBalances } from '@/entities/account';
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

// Create debts toggle (local, synced to formData)
const createDebts = computed({
  get: () => props.formData.createDebts,
  set: (val: boolean) => {
    emit('update:formData', { ...props.formData, createDebts: val });
  },
});

// Transaction count = always 1 (handleSubmit creates a single transaction for the full receipt total)
const transactionCount = computed(() => 1);

// Debt count = non-me participants
const debtCount = computed(() =>
  props.participantSummaries.filter((p) => !p.isMe && p.itemCount > 0).length
);

function handleSubmit() {
  haptics.tap();
  emit('submit');
}

function handleBack() {
  haptics.tap();
  emit('back');
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- Success overlay -->
    <Transition name="fade">
      <div
        v-if="isSuccess"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background-light dark:bg-background-dark animate-fadeInUp"
        aria-live="assertive"
      >
        <div class="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6 animate-scaleIn">
          <UIcon name="receipt_long" size="2xl" class="text-success" />
        </div>
        <h2 class="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
          Готово!
        </h2>
        <p class="text-base text-text-secondary-light dark:text-text-secondary-dark text-center px-8">
          Создана 1 транзакция
          <template v-if="createDebts"> и {{ debtCount }} долгов</template>
        </p>
      </div>
    </Transition>

    <!-- Scrollable summary content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-5"
      :class="isSubmitting && 'opacity-60 pointer-events-none'"
    >

      <!-- Per-person breakdown cards -->
      <section aria-label="Разбивка по участникам">
        <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3">
          Кто платит сколько
        </h2>

        <div class="space-y-3">
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

      <!-- Transaction details form -->
      <section aria-label="Параметры транзакций" class="space-y-4">
        <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
          Параметры
        </h2>

        <!-- Account selector -->
        <AccountSelector
          :accounts="accounts"
          :selected-id="formData.accountId"
          label="Счёт"
          @select="$emit('update:formData', { ...formData, accountId: $event })"
        />

        <!-- Category chips -->
        <CategoryChips
          :categories="EXPENSE_CATEGORIES"
          :selected-id="formData.categoryId"
          label="Категория"
          @select="$emit('update:formData', { ...formData, categoryId: $event })"
        />

        <!-- Description + Date row -->
        <div class="grid grid-cols-2 gap-2">
          <UInput
            :model-value="formData.description"
            label="Комментарий"
            placeholder="#продукты, #кафе..."
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
                  class="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark transition-all duration-150"
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
          aria-label="Создать долги для участников"
          class="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark transition-all"
          :class="createDebts && 'border-primary bg-primary/5'"
          @click="createDebts = !createDebts"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center"
              :class="createDebts
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
            >
              <UIcon name="group" size="sm" />
            </div>
            <div class="text-left">
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Создать долги
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Участники увидят, сколько должны вам
              </p>
            </div>
          </div>
          <!-- Toggle switch -->
          <div
            class="w-12 h-7 rounded-full transition-all relative flex-shrink-0"
            :class="createDebts ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
          >
            <div
              class="absolute w-5 h-5 bg-white rounded-full top-1 shadow-xs transition-all"
              :class="createDebts ? 'right-1' : 'left-1'"
            />
          </div>
        </button>

      </section>

      <!-- Total summary -->
      <div class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark space-y-2">
        <template v-if="serviceChargePercent">
          <div class="flex justify-between items-baseline">
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Подытог
            </span>
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
              {{ formatCurrency(subtotal, currency) }}
            </span>
          </div>
          <div class="flex justify-between items-baseline">
            <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Обслуживание {{ serviceChargePercent }}%
            </span>
            <span class="text-sm text-primary tabular-nums font-medium">
              +{{ formatCurrency(serviceChargeAmount, currency) }}
            </span>
          </div>
          <div class="h-px bg-border-light dark:bg-border-dark" />
        </template>
        <div class="flex justify-between items-baseline">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Сумма чека
          </span>
          <span class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums">
            {{ formatCurrency(totalAmount, currency) }}
          </span>
        </div>
        <div class="h-px bg-border-light dark:bg-border-dark" />
        <div class="flex justify-between items-center">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Создаётся транзакций
          </span>
          <UBadge variant="primary" size="sm" shape="pill">
            {{ transactionCount }}
          </UBadge>
        </div>
        <div v-if="createDebts" class="flex justify-between items-center">
          <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Создаётся долгов
          </span>
          <UBadge variant="neutral" size="sm" shape="pill">
            {{ debtCount }}
          </UBadge>
        </div>
      </div>

    </div>

    <!-- Sticky footer: error + create button -->
    <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark">

      <!-- Validation error -->
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
        aria-label="Создать транзакции по чеку"
        @click="handleSubmit"
      >
        <UIcon name="receipt_long" size="sm" class="mr-2" />
        Создать транзакции
      </UButton>
    </div>

  </div>
</template>

<style scoped>
.section-slide-enter-active,
.section-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.section-slide-enter-from,
.section-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
