<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { AccountSelector } from '@/entities/account';
import { CategoryChips, EXPENSE_CATEGORIES } from '@/entities/category';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
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

const { trigger } = useHaptics();
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

// Участники, которые должны (не «я» и с суммой > 0)
const owers = computed(() => props.participantSummaries.filter((p) => !p.isMe && p.total > 0));

// Debt count = non-me participants with items
const debtCount = computed(
  () => props.participantSummaries.filter((p) => !p.isMe && p.itemCount > 0).length,
);

function handleSubmit() {
  trigger('selection');
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
    <!-- Success overlay (Fullscreen Receipt) -->
    <Transition name="receipt-slide-up">
      <div
        v-if="isSuccess"
        class="fixed inset-0 z-50 flex flex-col items-center bg-background-light dark:bg-background-dark/95 backdrop-blur-md px-4 pt-[calc(1rem+var(--safe-area-inset-top))] pb-[calc(1.5rem+var(--safe-area-inset-bottom))]"
        aria-live="assertive"
      >
        <!-- The big receipt card -->
        <div
          class="flex-1 flex flex-col w-full max-w-[340px] bg-white dark:bg-surface-dark rounded-t-3xl rounded-b-xl shadow-2xl shadow-primary/10 dark:shadow-none overflow-hidden relative receipt-card"
        >
          <!-- Decorative receipt top -->
          <div class="h-2 bg-primary w-full" />

          <div
            class="px-6 pt-8 pb-6 flex flex-col items-center border-b border-dashed border-border-light dark:border-border-dark relative"
          >
            <div
              class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4 success-icon"
            >
              <UIcon name="check_circle" size="xl" class="text-success" />
            </div>
            <p
              class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-1 success-hero"
            >
              {{ storeName || 'Чек оплачен' }}
            </p>
            <h2
              class="text-4xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight mb-2 success-hero"
            >
              {{ formatCurrency(totalAmount, currency) }}
            </h2>
            <p
              class="text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark font-medium success-hero"
            >
              {{ displayDate }}
            </p>

            <!-- Absolute decoration: Cutouts -->
            <div
              class="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark/95 shadow-inner"
            />
            <div
              class="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark/95 shadow-inner"
            />
          </div>

          <!-- Who owes what list -->
          <div class="flex-1 px-6 py-6 overflow-y-auto no-scrollbar success-list">
            <h3
              class="text-[11px] font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-4"
            >
              Кто сколько должен
            </h3>

            <div class="space-y-4">
              <div v-for="p in owers" :key="p.id" class="flex items-center gap-3">
                <!-- Avatar -->
                <InitialAvatar :name="p.name" :color="p.color" size="md" />

                <div class="flex-1 min-w-0 flex items-baseline">
                  <span
                    class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mr-2"
                  >
                    {{ p.name }}
                  </span>
                  <!-- Dotted leader line -->
                  <div
                    class="flex-1 border-b-2 border-dotted border-border-light dark:border-border-dark opacity-50 relative top-[-4px] mx-1"
                  ></div>
                  <span
                    class="text-sm font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums ml-2"
                  >
                    {{ formatCurrency(p.total, currency) }}
                  </span>
                </div>
              </div>

              <!-- Empty state if no debts -->
              <div v-if="owers.length === 0" class="text-center py-4">
                <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
                  Никто ничего не должен 🙌
                </p>
              </div>
            </div>

            <p
              v-if="serviceChargePercent && serviceChargeAmount > 0"
              class="text-[10px] text-text-tertiary-light dark:text-text-tertiary-dark text-center mt-6"
            >
              Суммы включают {{ serviceChargePercent }}% за обслуживание
            </p>

            <!-- Watermark for shared image (hidden in UI via CSS, shown in canvas) -->
            <div
              class="hidden share-watermark text-center mt-8 pt-4 border-t border-border-light/50 opacity-60"
            >
              <span class="text-[10px] font-bold text-primary uppercase tracking-widest">
                Рассчитано в Ouro Finance
              </span>
            </div>
          </div>

          <!-- Bottom zig-zag edge -->
          <div
            class="receipt-edge h-3 w-full absolute bottom-0 bg-background-light dark:bg-background-dark/95 z-20 translate-y-[1px]"
          />
        </div>

        <!-- Action buttons area -->
        <div class="w-full max-w-[340px] flex-shrink-0 pt-6 px-2">
          <!-- Share actions -->
          <div class="grid grid-cols-3 gap-3 mb-6 success-actions">
            <button
              v-for="btn in shareActions"
              :key="btn.icon"
              type="button"
              :disabled="isSharing"
              class="flex flex-col items-center gap-2"
              @click="btn.action"
            >
              <div
                class="w-12 h-12 rounded-full bg-surface-light dark:bg-surface-dark flex items-center justify-center active:scale-95 transition-all shadow-sm"
              >
                <UIcon :name="btn.icon" size="sm" class="text-primary" />
              </div>
              <span
                class="text-[10px] font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide"
              >
                {{ btn.label }}
              </span>
            </button>
          </div>

          <!-- Done button -->
          <div class="success-done">
            <UButton
              variant="primary"
              size="xl"
              full-width
              @click="router.push({ name: ROUTE_NAMES.DASHBOARD })"
            >
              На главную
            </UButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Scrollable content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4 space-y-4"
      :class="isSubmitting && 'opacity-50 pointer-events-none'"
    >
      <!-- Total summary card (Skeuomorphic Receipt) -->
      <div
        class="relative bg-surface-light dark:bg-surface-dark px-5 pt-5 pb-6 mb-2 mt-1 drop-shadow-sm"
      >
        <!-- Zigzag bottom border -->
        <div
          class="receipt-edge absolute inset-x-0 -bottom-2 h-3 bg-surface-light dark:bg-surface-dark z-10"
        />

        <!-- Subtle texture/lines -->
        <div class="absolute inset-x-6 top-10 space-y-3 opacity-[0.03] pointer-events-none">
          <div class="h-1 bg-current rounded-full w-3/4 mx-auto" />
          <div class="h-1 bg-current rounded-full w-5/6 mx-auto" />
        </div>

        <div class="relative z-10">
          <template v-if="serviceChargePercent && serviceChargeAmount > 0">
            <div class="flex justify-between items-baseline mb-1.5">
              <span
                class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider font-medium"
              >
                Подытог
              </span>
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
              >
                {{ formatCurrency(subtotal, currency) }}
              </span>
            </div>
            <div class="flex justify-between items-baseline mb-3">
              <span class="text-xs text-primary uppercase tracking-wider font-medium">
                Обсл. ({{ serviceChargePercent }}%)
              </span>
              <span class="text-sm text-primary tabular-nums">
                +{{ formatCurrency(serviceChargeAmount, currency) }}
              </span>
            </div>
            <div
              class="h-[1.5px] border-b-2 border-dashed border-border-light dark:border-border-dark mb-3"
            />
          </template>

          <div class="flex flex-col items-center justify-center mt-2">
            <span
              class="text-[10px] uppercase tracking-widest text-text-tertiary-light dark:text-text-tertiary-dark font-bold mb-1"
            >
              Итого к оплате
            </span>
            <span
              class="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight"
            >
              {{ formatCurrency(totalAmount, currency) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Per-person breakdown -->
      <section aria-label="Разбивка по участникам">
        <h2
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2.5"
        >
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

      <!-- Transaction parameters (iOS Style Inset Grouped List) -->
      <section aria-label="Параметры транзакции" class="mt-6">
        <h2
          class="text-[11px] font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-2 ml-4"
        >
          Оплата
        </h2>

        <div
          class="bg-surface-light dark:bg-surface-dark rounded-2xl overflow-hidden drop-shadow-sm border border-border-light/50 dark:border-border-dark/50 divide-y divide-border-light dark:divide-border-dark"
        >
          <!-- Account -->
          <div class="px-4 py-3">
            <AccountSelector
              :accounts="accounts"
              :selected-id="formData.accountId"
              label="Списать со счёта"
              @select="$emit('update:formData', { ...formData, accountId: $event })"
            />
          </div>

          <!-- Category -->
          <div class="px-4 py-3">
            <CategoryChips
              :categories="EXPENSE_CATEGORIES"
              :selected-id="formData.categoryId"
              label="Категория"
              @select="$emit('update:formData', { ...formData, categoryId: $event })"
            />
          </div>

          <!-- Date & Description -->
          <div class="grid grid-cols-2 divide-x divide-border-light dark:divide-border-dark">
            <div class="px-4 py-3 flex flex-col justify-center">
              <label
                class="text-[10px] font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider mb-1.5"
              >
                Дата
              </label>
              <Popover v-model:open="calendarOpen">
                <PopoverTrigger as-child>
                  <button
                    type="button"
                    class="flex items-center justify-between w-full text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-all duration-150 outline-none"
                  >
                    <span>{{ displayDate }}</span>
                    <UIcon
                      name="calendar_today"
                      size="xs"
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

            <div class="px-4 py-3 flex flex-col justify-center">
              <label
                class="text-[10px] font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider mb-1.5"
              >
                Заметка
              </label>
              <input
                :value="formData.description"
                type="text"
                placeholder="#ужин..."
                class="w-full bg-transparent text-sm font-medium outline-none text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark"
                @input="
                  $emit('update:formData', {
                    ...formData,
                    description: ($event.target as HTMLInputElement).value,
                  })
                "
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Debts Toggle -->
      <section class="mt-6 mb-2">
        <button
          v-if="debtCount > 0"
          type="button"
          role="switch"
          :aria-checked="createDebts"
          class="flex items-center justify-between w-full p-4 rounded-2xl bg-surface-light dark:bg-surface-dark border-2 border-transparent transition-all drop-shadow-sm outline-none active:scale-[0.98]"
          :class="createDebts && 'border-primary/30 ring-4 ring-primary/5 bg-primary/[0.03]'"
          @click="createDebts = !createDebts"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-sm"
              :class="
                createDebts
                  ? 'bg-primary text-white shadow-primary/30'
                  : 'bg-card-light dark:bg-card-dark text-text-tertiary-light dark:text-text-tertiary-dark border border-border-light dark:border-border-dark'
              "
            >
              <UIcon name="group" size="md" />
            </div>
            <div class="text-left">
              <p
                class="text-base font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight"
              >
                Создать долги
              </p>
              <p
                class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5"
              >
                Вернуть деньги с {{ debtCount }}
                {{ pluralize(debtCount, 'человека', 'человек', 'человек') }}
              </p>
            </div>
          </div>
          <!-- iOS Style Toggle -->
          <div
            class="w-14 h-8 rounded-full transition-colors duration-300 relative flex-shrink-0 shadow-inner"
            :class="createDebts ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
          >
            <div
              class="absolute w-6 h-6 bg-white rounded-full top-[4px] shadow-sm transition-transform duration-300 ease-in-out"
              :class="createDebts ? 'translate-x-[28px]' : 'translate-x-[4px]'"
            />
          </div>
        </button>

        <!-- What will be created -->
        <div class="flex items-center justify-center gap-2 mt-3 mb-2 opacity-70">
          <UIcon
            name="info"
            size="xs"
            class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0"
          />
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">
            Будет создана 1 транзакция
            <template v-if="createDebts && debtCount > 0">
              и {{ debtCount }} {{ pluralize(debtCount, 'долг', 'долга', 'долгов') }}
            </template>
          </span>
        </div>
      </section>
    </div>

    <!-- Sticky footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark"
    >
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
.receipt-slide-up-enter-active,
.receipt-slide-up-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.receipt-slide-up-enter-from,
.receipt-slide-up-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

/* Success overlay staggered animations */
.success-icon {
  animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}

.success-hero {
  animation: fadeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
}

.success-list {
  animation: fadeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
}

.success-actions {
  animation: fadeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
}

.success-done {
  animation: fadeSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both;
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

.receipt-edge {
  -webkit-mask-image: radial-gradient(circle at 6px 12px, transparent 6px, black 6px);
  mask-image: radial-gradient(circle at 6px 12px, transparent 6px, black 6px);
  -webkit-mask-size: 12px 12px;
  mask-size: 12px 12px;
  -webkit-mask-repeat: repeat-x;
  mask-repeat: repeat-x;
}
</style>
