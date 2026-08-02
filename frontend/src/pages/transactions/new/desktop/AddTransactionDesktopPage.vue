<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UButton, UIcon } from '@/shared/ui';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { UOverlay } from '@/shared/ui/overlay';
import { TransactionForm } from '@/features/add-transaction';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useAddTransactionPage } from '../model/useAddTransactionPage';

const router = useRouter();

/**
 * На мобиле autofocus и тяжёлый хвост формы ждут конца слайд-перехода
 * (`isPageTransitioning`). В модалке слайда нет — на десктопе `transitionName`
 * всегда `'none'`, поэтому форма готова сразу.
 */
const isReady = true;

/**
 * Модалка закрывается назад по истории — так же, как мобильная страница,
 * только без анимации слайда и без завязки на `@/app/router` (там живёт
 * обвязка слайд-переходов, которая модалке не нужна). Прямая ссылка без
 * истории возвращает на Главную.
 */
function close() {
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push({ name: ROUTE_NAMES.DASHBOARD });
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
} = useAddTransactionPage({ onDone: close });
</script>

<template>
  <UOverlay model-value desktop="dialog" title="Новая транзакция" @update:model-value="close">
    <!-- Пока счета грузятся, форма без счёта выглядит сломанной: пустой
         селектор и заблокированная кнопка. Показываем каркас. -->
    <div v-if="accountsLoading && accounts.length === 0" class="space-y-3" aria-busy="true">
      <Skeleton class="h-28 w-full rounded-2xl" />
      <Skeleton class="h-9 w-full rounded-lg" />
      <Skeleton class="h-16 w-full rounded-xl" />
      <Skeleton class="h-24 w-full rounded-xl" />
    </div>

    <div v-else-if="accounts.length === 0" data-testid="no-accounts-state" class="py-8 text-center">
      <UIcon
        name="account_balance_wallet"
        size="lg"
        class="mb-3 text-text-tertiary-light dark:text-text-tertiary-dark"
      />
      <p class="mb-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
        У вас пока нет счетов
      </p>
      <UButton variant="primary" size="sm" @click="router.push({ name: ROUTE_NAMES.NEW_ACCOUNT })">
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
      flush
      @submit="handleSubmit"
      @debt-submitted="close"
      @add-participant="addParticipant"
      @remove-participant="removeParticipant"
      @update-participant-amount="updateParticipantAmount"
      @set-split-method="setSplitMethod"
      @set-my-share="setMyShare"
      @set-is-included="setIsIncluded"
      @set-split-enabled="setSplitEnabled"
    />
  </UOverlay>
</template>
