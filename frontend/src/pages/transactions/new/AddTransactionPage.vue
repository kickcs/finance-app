<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { AppHeader } from '@/widgets/header';
import { TransactionForm } from '@/features/add-transaction';
import { navigateBack, navigateBackTo, isPageTransitioning } from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useAddTransactionPage } from './model/useAddTransactionPage';

const router = useRouter();

/**
 * Клавиатуру открываем и тяжёлый хвост формы дорисовываем после слайда: во
 * время перехода клавиатура пересчитывает `h-dvh`, а монтирование календаря и
 * vaul-шита съедает те же кадры, в которых страница едет.
 *
 * Защёлка в одну сторону: обратный переход (уход со страницы) снова поднимает
 * флаг, и простой `computed` выдернул бы хвост формы из уже уезжающего экрана —
 * ровно тот дефект, который здесь и лечится.
 */
const isReady = ref(false);
watch(isPageTransitioning, (transitioning) => !transitioning && (isReady.value = true), {
  immediate: true,
});

/**
 * На этом экране нижняя навигация скрыта (сфокусированный поток), поэтому
 * тупик «зашёл по прямой ссылке — истории нет — кнопка «назад» ничего не
 * делает» больше нечем спасти. Уходим на дашборд.
 */
function goBack() {
  if (window.history.state?.back) {
    navigateBack();
  } else {
    // `navigateBackTo` — тот же replace, но с анимацией «назад»; голый
    // `router.replace` уехал бы вперёд.
    navigateBackTo({ name: ROUTE_NAMES.DASHBOARD });
  }
}

const {
  accounts,
  accountsLoading,
  expenseCategories,
  incomeCategories,
  defaultAccountId,
  userCurrency,
  formData,
  isValid,
  isSubmitting,
  validationError,
  splitData,
  splitValidationError,
  addParticipant,
  removeParticipant,
  updateParticipantAmount,
  setSplitMethod,
  setMyShare,
  setIsIncluded,
  setSplitEnabled,
  handleSubmit,
} = useAddTransactionPage({ onDone: goBack });
</script>

<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Шапка одна на все состояния: она же единственный выход с экрана —
         нижняя навигация на этом маршруте скрыта, а в standalone-PWA нет и
         кнопки браузера. -->
    <AppHeader title="Новая транзакция" show-back blur @back="goBack" />

    <main class="flex-1 overflow-y-auto">
      <div class="flex min-h-full flex-col md:mx-auto md:max-w-xl">
        <!-- Пока счета грузятся, форма без счёта выглядит сломанной: пустой
             селектор и заблокированная кнопка. Показываем каркас. -->
        <div
          v-if="accountsLoading && accounts.length === 0"
          class="space-y-3 px-4 pt-1"
          aria-busy="true"
        >
          <Skeleton class="h-28 w-full rounded-2xl" />
          <Skeleton class="h-9 w-full rounded-lg" />
          <Skeleton class="h-16 w-full rounded-xl" />
          <Skeleton class="h-24 w-full rounded-xl" />
        </div>

        <div
          v-else-if="accounts.length === 0"
          data-testid="no-accounts-state"
          class="px-4 py-8 text-center"
        >
          <UIcon
            name="account_balance_wallet"
            size="lg"
            class="mb-3 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <p class="mb-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            У вас пока нет счетов
          </p>
          <UButton
            variant="primary"
            size="sm"
            @click="router.push({ name: ROUTE_NAMES.NEW_ACCOUNT })"
          >
            Создать счёт
          </UButton>
        </div>

        <TransactionForm
          v-else
          v-model:form-data="formData"
          data-testid="transaction-form"
          :accounts="accounts"
          :expense-categories="expenseCategories"
          :income-categories="incomeCategories"
          :user-currency="userCurrency"
          :default-account-id="defaultAccountId"
          :is-submitting="isSubmitting"
          :is-valid="isValid"
          :error="validationError"
          :split-data="splitData"
          :split-validation-error="splitValidationError"
          :autofocus-amount="isReady"
          :ready="isReady"
          @submit="handleSubmit"
          @debt-submitted="goBack"
          @add-participant="addParticipant"
          @remove-participant="removeParticipant"
          @update-participant-amount="updateParticipantAmount"
          @set-split-method="setSplitMethod"
          @set-my-share="setMyShare"
          @set-is-included="setIsIncluded"
          @set-split-enabled="setSplitEnabled"
        />
      </div>
    </main>
  </div>
</template>
