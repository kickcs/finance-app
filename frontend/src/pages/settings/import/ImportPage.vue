<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { UButton, UIcon, UCard } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useImportWizard } from './model/useImportWizard';

const router = useRouter();

const {
  step,
  parseResult,
  importResult,
  parseError,
  importMutation,
  fileInput,
  previewTransactions,
  openFilePicker,
  handleFileChange,
  handleImport,
} = useImportWizard();

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} — ${formatDate(to)}`;
}

function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toLocaleString('ru-RU')}`;
}

function goToTransactions() {
  router.push('/history');
}

function goHome() {
  router.push('/');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <AppHeader title="Импорт данных" show-back @back="navigateBack" />

    <input
      ref="fileInput"
      type="file"
      accept=".csv"
      class="hidden"
      @change="handleFileChange"
    />

    <main class="px-5 pt-6 space-y-4">
      <!-- Step 1: Select App -->
      <template v-if="step === 'select'">
        <p
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2"
        >
          Выберите приложение, из которого хотите импортировать данные
        </p>

        <!-- MoneyLover -->
        <UCard clickable class="p-4" @click="openFilePicker">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"
            >
              <UIcon name="wallet" size="md" class="text-emerald-500" />
            </div>
            <div class="flex-1">
              <p
                class="font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                MoneyLover
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                Импорт из CSV файла
              </p>
            </div>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </div>
        </UCard>

        <!-- Coming soon -->
        <UCard class="p-4 opacity-50">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
            >
              <UIcon
                name="list"
                size="md"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </div>
            <div class="flex-1">
              <p
                class="font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                Google Sheets
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                Скоро
              </p>
            </div>
          </div>
        </UCard>

        <UCard class="p-4 opacity-50">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
            >
              <UIcon
                name="receipt_long"
                size="md"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </div>
            <div class="flex-1">
              <p
                class="font-semibold text-text-primary-light dark:text-text-primary-dark"
              >
                Excel
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                Скоро
              </p>
            </div>
          </div>
        </UCard>

        <!-- Parse error -->
        <p v-if="parseError" class="text-sm text-danger text-center mt-4">
          {{ parseError }}
        </p>
      </template>

      <!-- Step 2: Preview -->
      <template v-if="step === 'preview' && parseResult">
        <!-- Stats -->
        <div class="grid grid-cols-2 gap-3">
          <UCard class="p-4 text-center">
            <p
              class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ parseResult.stats.total_rows.toLocaleString('ru-RU') }}
            </p>
            <p
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1"
            >
              Транзакций
            </p>
          </UCard>

          <UCard class="p-4 text-center">
            <p
              class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ parseResult.stats.unique_categories.length }}
            </p>
            <p
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1"
            >
              Категорий
            </p>
          </UCard>

          <UCard class="p-4 text-center">
            <p
              class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ parseResult.stats.unique_accounts.length }}
            </p>
            <p
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1"
            >
              Счетов
            </p>
          </UCard>

          <UCard v-if="parseResult.stats.date_range" class="p-4 text-center">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{
                formatDateRange(
                  parseResult.stats.date_range.from,
                  parseResult.stats.date_range.to,
                )
              }}
            </p>
            <p
              class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1"
            >
              Период
            </p>
          </UCard>
        </div>

        <!-- Parse errors -->
        <p
          v-if="parseResult.errors.length > 0"
          class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ parseResult.errors.length }} строк пропущено из-за ошибок
        </p>

        <!-- Transaction preview -->
        <p
          class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
        >
          Предпросмотр
        </p>

        <UCard class="divide-y divide-border-light dark:divide-border-dark">
          <div
            v-for="(tx, i) in previewTransactions"
            :key="i"
            class="flex items-center gap-3 px-4 py-3"
          >
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ tx.category_name }}
              </p>
              <p
                v-if="tx.note"
                class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate"
              >
                {{ tx.note }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p
                class="text-sm font-semibold"
                :class="tx.amount >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatAmount(tx.amount) }}
              </p>
              <p
                class="text-xs text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ formatDate(tx.date) }}
              </p>
            </div>
          </div>
          <div
            v-if="parseResult.data.length > 20"
            class="px-4 py-3 text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            ... и ещё
            {{ (parseResult.data.length - 20).toLocaleString('ru-RU') }}
            транзакций
          </div>
        </UCard>

        <!-- Import button -->
        <div
          class="fixed bottom-0 left-0 right-0 p-5 bg-background-light dark:bg-background-dark border-t border-border-light dark:border-border-dark"
        >
          <UButton
            variant="primary"
            size="lg"
            full-width
            :loading="importMutation.isPending.value"
            @click="handleImport"
          >
            Импортировать
            {{ parseResult.stats.total_rows.toLocaleString('ru-RU') }}
            транзакций
          </UButton>
        </div>

        <!-- Import error -->
        <p
          v-if="importMutation.isError.value"
          class="text-sm text-danger text-center"
        >
          Ошибка импорта. Попробуйте ещё раз.
        </p>
      </template>

      <!-- Step 3: Result -->
      <template v-if="step === 'result' && importResult">
        <div class="text-center py-8 space-y-4">
          <div
            class="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto"
          >
            <UIcon name="check_circle" size="lg" class="text-success" />
          </div>

          <div>
            <h2
              class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              Импорт завершён
            </h2>
            <p
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1"
            >
              {{ importResult.imported_count.toLocaleString('ru-RU') }}
              транзакций добавлено
            </p>
          </div>

          <!-- Details -->
          <div class="space-y-2 text-left">
            <UCard
              v-if="importResult.categories_created.length > 0"
              class="p-4"
            >
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2"
              >
                Новые категории ({{ importResult.categories_created.length }})
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ importResult.categories_created.join(', ') }}
              </p>
            </UCard>

            <UCard v-if="importResult.accounts_created.length > 0" class="p-4">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2"
              >
                Новые счета ({{ importResult.accounts_created.length }})
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ importResult.accounts_created.join(', ') }}
              </p>
            </UCard>
          </div>

          <!-- Actions -->
          <div class="space-y-3 pt-4">
            <UButton
              variant="primary"
              size="lg"
              full-width
              @click="goToTransactions"
            >
              К транзакциям
            </UButton>
            <UButton variant="secondary" size="lg" full-width @click="goHome">
              На главную
            </UButton>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
