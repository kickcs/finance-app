<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useTimeoutFn } from '@vueuse/core';
import { UButton, UIcon, Skeleton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatCardNumber } from '@/shared/lib/format/cardNumber';
import { formatDate, formatLocalDate } from '@/shared/lib/format/date';
import { pluralize } from '@/shared/lib/format/pluralize';
import { cn } from '@/shared/lib/utils';
import {
  sharedDebtsApi,
  SharedDebtsNotFoundError,
  type SharedDebts,
} from '@/features/view-shared-debts';

const route = useRoute();

const shared = ref<SharedDebts | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const loadError = ref(false);

const isPositive = computed(() => (shared.value?.net ?? 0) >= 0);
const debtsCount = computed(() => shared.value?.debts.length ?? 0);
/** Обе стороны непустые — значит есть встречные долги, и их стоит развести. */
const hasBothSides = computed(
  () => !!shared.value && shared.value.totalGiven > 0 && shared.value.totalTaken > 0,
);

async function load() {
  const token = String(route.params.token ?? '');
  isLoading.value = true;
  notFound.value = false;
  loadError.value = false;
  try {
    shared.value = await sharedDebtsApi.get(token);
  } catch (error) {
    if (error instanceof SharedDebtsNotFoundError) notFound.value = true;
    else loadError.value = true;
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);

// Карта для перевода — то, ради чего страницу и открывают вторым заходом,
// поэтому номер копируется одним тапом, без выделения пальцем по цифрам
const isCardCopied = ref(false);
const { start: scheduleCopyReset } = useTimeoutFn(() => {
  isCardCopied.value = false;
}, 2000);

async function copyCard() {
  const cardNumber = shared.value?.cardNumber;
  if (!cardNumber) return;
  try {
    await navigator.clipboard.writeText(cardNumber);
    isCardCopied.value = true;
    scheduleCopyReset();
  } catch {
    // Буфер недоступен (нет разрешения, http) — номер и так на экране,
    // его можно выделить руками
  }
}

/**
 * Прощённое называем отдельной частью: без него «отдано 20 000 из 50 000»
 * рядом с остатком 20 000 не сходится, а по этой странице двое сверяются.
 */
function debtMeta(debt: SharedDebts['debts'][number]): string {
  const parts: string[] = [];
  if (debt.paidAmount > 0) {
    parts.push(
      `отдано ${formatCurrency(debt.paidAmount, debt.currency)} из ${formatCurrency(debt.totalAmount, debt.currency)}`,
    );
  }
  if (debt.forgivenAmount > 0) {
    parts.push(`прощено ${formatCurrency(debt.forgivenAmount, debt.currency)}`);
  }
  if (debt.dueDate) parts.push(`до ${formatDate(debt.dueDate, { format: 'short' })}`);
  return parts.length > 0 ? parts.join(' · ') : 'без срока';
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark">
    <div class="max-w-md mx-auto px-4 py-6 space-y-5">
      <!-- Загрузка -->
      <template v-if="isLoading">
        <Skeleton class="h-56 rounded-3xl" />
        <Skeleton class="h-14 rounded-xl" />
        <Skeleton class="h-14 rounded-xl" />
      </template>

      <!-- Не найдено -->
      <div v-else-if="notFound" class="flex flex-col items-center gap-4 pt-24 px-6 text-center">
        <div
          class="w-16 h-16 rounded-2xl bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon
            name="handshake"
            size="xl"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
        <div>
          <h1
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
          >
            Сверка не найдена
          </h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Ссылка неверна или сверка была удалена
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
            Не удалось загрузить сверку
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

      <!-- Сверка -->
      <template v-else-if="shared">
        <!-- Карточка итога -->
        <div
          class="bg-white dark:bg-surface-dark rounded-t-3xl rounded-b-xl shadow-xl shadow-primary/10 dark:shadow-none overflow-hidden"
        >
          <div class="h-2 w-full" :class="isPositive ? 'bg-debt-given' : 'bg-debt-received'" />
          <div
            class="px-6 pt-7 pb-6 flex flex-col items-center border-b border-dashed border-border-light dark:border-border-dark relative"
          >
            <p
              class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-widest mb-1"
            >
              {{ shared.personName }}
            </p>
            <p
              :class="
                cn(
                  'text-4xl font-black tabular-nums tracking-tight mb-1 text-center break-words',
                  isPositive ? 'text-debt-given' : 'text-debt-received',
                )
              "
            >
              {{ isPositive ? '+' : '−'
              }}{{ formatCurrency(Math.abs(shared.net), shared.currency) }}
            </p>
            <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
              {{ isPositive ? 'должен вам' : 'вы должны' }}
            </p>
            <p
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark font-medium text-center"
            >
              на {{ formatLocalDate(shared.snapshotAt) }}
              <template v-if="shared.ownerName">· от {{ shared.ownerName }}</template>
            </p>

            <!-- Вырезы, как у бумажного чека -->
            <div
              class="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark shadow-inner"
            />
            <div
              class="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark shadow-inner"
            />
          </div>

          <!-- Две чаши показываем только когда есть встречные долги: иначе они
               просто повторяют итог сверху -->
          <div v-if="hasBothSides" class="px-6 py-4 grid grid-cols-2 gap-4">
            <div class="min-w-0">
              <p
                class="flex items-center gap-1.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-debt-given" />
                Должен вам
              </p>
              <p
                class="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark break-words"
              >
                {{ formatCurrency(shared.totalGiven, shared.currency) }}
              </p>
            </div>
            <div class="min-w-0 text-right">
              <p
                class="flex items-center justify-end gap-1.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-debt-received" />
                Вы должны
              </p>
              <p
                class="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark break-words"
              >
                {{ formatCurrency(shared.totalTaken, shared.currency) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Куда переводить -->
        <div
          v-if="shared.cardNumber"
          class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark px-4 py-3.5"
        >
          <p
            class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Карта для перевода
          </p>
          <div class="mt-1.5 flex items-center gap-2">
            <p
              class="flex-1 min-w-0 truncate text-h3 font-bold tabular-nums tracking-wide text-text-primary-light dark:text-text-primary-dark select-all"
            >
              {{ formatCardNumber(shared.cardNumber) }}
            </p>
            <button
              type="button"
              :aria-label="isCardCopied ? 'Номер карты скопирован' : 'Копировать номер карты'"
              class="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary active:scale-90 transition-transform"
              data-testid="shared-debts-copy-card"
              @click="copyCard"
            >
              <UIcon :name="isCardCopied ? 'check' : 'content_copy'" size="sm" />
            </button>
          </div>
        </div>

        <!-- Список долгов -->
        <section class="space-y-2">
          <h2
            class="px-1 text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ debtsCount }} {{ pluralize(debtsCount, 'долг', 'долга', 'долгов') }}
          </h2>

          <div
            v-if="debtsCount > 0"
            class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden divide-y divide-border-light dark:divide-border-dark"
          >
            <div
              v-for="(debt, index) in shared.debts"
              :key="`${debt.title}-${index}`"
              class="flex items-center gap-3 px-4 py-3.5"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="debt.direction === 'given' ? 'bg-debt-given' : 'bg-debt-received'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2">
                  <p
                    class="min-w-0 truncate text-body font-semibold text-text-primary-light dark:text-text-primary-dark"
                  >
                    {{ debt.title }}
                  </p>
                  <p
                    :class="
                      cn(
                        'ml-auto shrink-0 text-body font-bold tabular-nums',
                        debt.direction === 'given' ? 'text-debt-given' : 'text-debt-received',
                      )
                    "
                  >
                    {{ formatCurrency(debt.remainingAmount, debt.currency) }}
                  </p>
                </div>
                <p
                  class="mt-0.5 truncate text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  {{ debtMeta(debt) }}
                </p>
              </div>
            </div>
          </div>

          <p
            v-else
            class="rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark px-4 py-6 text-center text-body-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Открытых долгов нет
          </p>
        </section>

        <p class="px-1 text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Это снимок на {{ formatLocalDate(shared.snapshotAt) }} — он не обновляется после изменений
          в приложении
        </p>

        <!-- Футер -->
        <footer class="pt-2 pb-2 text-center">
          <a
            href="/"
            class="inline-flex items-center gap-1.5 text-caption font-semibold text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors uppercase tracking-widest"
          >
            <UIcon name="handshake" size="xs" />
            Создано в Ouro Finance
          </a>
        </footer>
      </template>
    </div>
  </div>
</template>
