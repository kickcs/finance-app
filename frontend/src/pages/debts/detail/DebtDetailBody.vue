<script setup lang="ts">
import { USpinner, NotFoundState } from '@/shared/ui';
import { DebtDetailContent } from '@/entities/debt';
import { useDebtDetailContext } from '../model/useDebtDetail';

/**
 * Тело экрана долга без обрамления: отступы и шапку каждый хост ставит свои,
 * а содержимое у страницы и десктопной панели одно и то же.
 */
const { debt, isLoading, transactions, transactionsLoading, accounts, openPayment } =
  useDebtDetailContext();
</script>

<template>
  <div v-if="isLoading" data-testid="debt-loading" class="flex items-center justify-center py-12">
    <USpinner />
  </div>

  <NotFoundState v-else-if="!debt" data-testid="not-found" message="Долг не найден" />

  <DebtDetailContent
    v-else
    :debt="debt"
    :transactions="transactions"
    :accounts="accounts"
    :transactions-loading="transactionsLoading"
    @payment="openPayment"
  />
</template>
