<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { UButton, UIcon, InitialAvatar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { ParticipantSummary, ReceiptCharge } from '../model/types';

const props = withDefaults(
  defineProps<{
    isSuccess: boolean;
    totalAmount: number;
    currency: string;
    storeName: string | null;
    displayDate: string;
    owers: ParticipantSummary[];
    hasCharges: boolean;
    enabledCharges: ReceiptCharge[];
    isSharing: boolean;
    shareActions: { icon: string; label: string; action: () => void }[];
    /** Route name for the "done" button. Defaults to the dashboard. */
    doneRoute?: string;
    doneLabel?: string;
  }>(),
  {
    doneRoute: ROUTE_NAMES.DASHBOARD,
    doneLabel: 'На главную',
  },
);

const emit = defineEmits<{
  shareLink: [];
}>();

const router = useRouter();

function formatChargeBadge(charge: ReceiptCharge): string {
  if (charge.type === 'amount') {
    return `${formatCurrency(charge.amount, props.currency)} ${charge.label.toLowerCase()}`;
  }
  return `${charge.percent}% ${charge.label.toLowerCase()}`;
}
</script>

<template>
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
            class="font-mono text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-1 success-hero"
          >
            {{ storeName || 'Чек оплачен' }}
          </p>
          <h2
            class="text-4xl font-mono font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight mb-2 success-hero"
          >
            {{ formatCurrency(totalAmount, currency) }}
          </h2>
          <p
            class="font-mono text-caption text-text-tertiary-light dark:text-text-tertiary-dark font-medium success-hero"
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
            class="font-mono text-caption font-bold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-4"
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
                  class="text-sm font-mono font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums ml-2"
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
            v-if="hasCharges"
            class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark text-center mt-6"
          >
            Суммы включают
            {{ enabledCharges.map(formatChargeBadge).join(', ') }}
          </p>

          <!-- Watermark for shared image (hidden in UI via CSS, shown in canvas) -->
          <div
            class="hidden share-watermark text-center mt-8 pt-4 border-t border-border-light/50 opacity-60"
          >
            <span class="text-caption-sm font-bold text-primary uppercase tracking-widest">
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
        <!-- Поделиться ссылкой (получателю не нужно приложение) -->
        <div class="success-actions mb-3">
          <UButton variant="secondary" size="lg" full-width @click="emit('shareLink')">
            <UIcon name="link" size="sm" class="mr-2" />
            Поделиться ссылкой
          </UButton>
        </div>

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
              class="text-caption-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide"
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
            @click="router.push({ name: props.doneRoute })"
          >
            {{ props.doneLabel }}
          </UButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

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
</style>

<style>
@import './transitions.css';
</style>
