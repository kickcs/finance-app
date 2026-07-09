<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { UButton, UIcon, Skeleton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import {
  sharedReceiptApi,
  SharedReceiptNotFoundError,
  ParticipantBreakdown,
  PaymentMethodsBlock,
  type SharedReceipt,
} from '@/features/view-shared-receipt';

const route = useRoute();

const receipt = ref<SharedReceipt | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const loadError = ref(false);

async function load() {
  const token = String(route.params.token ?? '');
  isLoading.value = true;
  notFound.value = false;
  loadError.value = false;
  try {
    receipt.value = await sharedReceiptApi.get(token);
  } catch (error) {
    if (error instanceof SharedReceiptNotFoundError) notFound.value = true;
    else loadError.value = true;
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark">
    <div class="max-w-md mx-auto px-4 py-6 space-y-5">
      <!-- Загрузка -->
      <template v-if="isLoading">
        <Skeleton class="h-48 rounded-3xl" />
        <Skeleton class="h-14 rounded-xl" />
        <Skeleton class="h-14 rounded-xl" />
        <Skeleton class="h-14 rounded-xl" />
      </template>

      <!-- Не найден -->
      <div v-else-if="notFound" class="flex flex-col items-center gap-4 pt-24 px-6 text-center">
        <div
          class="w-16 h-16 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon
            name="receipt_long"
            size="xl"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <div>
          <h1
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
          >
            Чек не найден
          </h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Ссылка неверна или чек был удалён
          </p>
        </div>
      </div>

      <!-- Ошибка сети -->
      <div v-else-if="loadError" class="flex flex-col items-center gap-4 pt-24 px-6 text-center">
        <div class="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center">
          <UIcon name="error_outline" size="xl" class="text-danger" />
        </div>
        <div>
          <h1
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
          >
            Не удалось загрузить чек
          </h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Проверьте соединение и попробуйте ещё раз
          </p>
        </div>
        <UButton variant="primary" size="md" @click="load">
          <UIcon name="refresh" size="sm" class="mr-2" />
          Повторить
        </UButton>
      </div>

      <!-- Чек -->
      <template v-else-if="receipt">
        <!-- Карточка-«чек» -->
        <div
          class="bg-white dark:bg-surface-dark rounded-t-3xl rounded-b-xl shadow-xl shadow-primary/10 dark:shadow-none overflow-hidden"
        >
          <div class="h-2 bg-primary w-full" />
          <div
            class="px-6 pt-7 pb-5 flex flex-col items-center border-b border-dashed border-border-light dark:border-border-dark relative"
          >
            <p
              class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-1"
            >
              {{ receipt.storeName || 'Чек' }}
            </p>
            <p
              class="text-4xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight mb-1.5"
            >
              {{ formatCurrency(receipt.totalAmount, receipt.currency) }}
            </p>
            <p
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark font-medium"
            >
              {{ formatDate(receipt.date) }}
              <template v-if="receipt.ownerName">· от {{ receipt.ownerName }}</template>
            </p>

            <!-- Вырезы, как у бумажного чека -->
            <div
              class="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark shadow-inner"
            />
            <div
              class="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark shadow-inner"
            />
          </div>

          <div class="px-6 py-4">
            <div class="flex items-baseline justify-between text-caption">
              <span class="text-text-tertiary-light dark:text-text-tertiary-dark">Позиции</span>
              <span class="text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
                {{ formatCurrency(receipt.subtotal, receipt.currency) }}
              </span>
            </div>
            <div
              v-for="charge in receipt.charges"
              :key="charge.label"
              class="flex items-baseline justify-between text-caption mt-1"
            >
              <span class="text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ charge.label }}
              </span>
              <span class="text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
                {{ charge.display }}
              </span>
            </div>
          </div>
        </div>

        <!-- Разбивка по участникам -->
        <ParticipantBreakdown :participants="receipt.participants" :currency="receipt.currency" />

        <!-- Реквизиты -->
        <PaymentMethodsBlock :methods="receipt.paymentMethods" />

        <!-- Футер -->
        <footer class="pt-4 pb-2 text-center">
          <a
            href="/"
            class="inline-flex items-center gap-1.5 text-caption font-semibold text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors uppercase tracking-widest"
          >
            <UIcon name="receipt_long" size="xs" />
            Создано в Ouro Finance
          </a>
        </footer>
      </template>
    </div>
  </div>
</template>
