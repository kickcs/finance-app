<script setup lang="ts">
import { DebtActionsSheet } from '@/entities/debt';
import { DeleteDebtModal } from '@/features/delete-debt';
import { ReopenDebtModal } from '@/features/reopen-debt';
import { PaymentDrawer } from '@/features/pay-debt';
import { EditDebtDrawer } from '@/features/edit-debt';
import { ShareDebtsDrawer } from '@/features/share-debts';
import { useDebtDetailContext } from '../model/useDebtDetail';

/**
 * Все шторки и модалки одного долга. Экран и десктопная панель подключают её
 * одинаково — состоянием и обработчиками заведует `useDebtDetail`.
 */
const {
  debt,
  accounts,
  currency,
  closingRecords,
  isActionsOpen,
  isEditOpen,
  isDeleteOpen,
  isReopenOpen,
  isPaymentOpen,
  isShareOpen,
  paymentDraft,
  sharePayload,
  isDeleting,
  isReopening,
  askDelete,
  askReopen,
  confirmDelete,
  confirmReopen,
  submitPayment,
  togglePrivate,
  openShare,
} = useDebtDetailContext();
</script>

<template>
  <DebtActionsSheet
    v-if="debt"
    v-model="isActionsOpen"
    :debt="debt"
    @share="openShare"
    @delete="askDelete"
    @reopen="askReopen"
    @toggle-private="togglePrivate"
  />

  <ReopenDebtModal
    v-model="isReopenOpen"
    :debt="debt"
    :closing-records="closingRecords"
    :accounts="accounts"
    :is-reopening="isReopening"
    @confirm="confirmReopen"
  />

  <DeleteDebtModal
    v-model="isDeleteOpen"
    :debt="debt"
    :currency="currency"
    :is-deleting="isDeleting"
    @confirm="confirmDelete"
  />

  <PaymentDrawer
    v-model="isPaymentOpen"
    :debt="debt"
    :accounts="accounts"
    :draft="paymentDraft"
    @confirm="submitPayment"
  />

  <ShareDebtsDrawer v-model="isShareOpen" :payload="sharePayload" />

  <EditDebtDrawer v-model="isEditOpen" :debt="debt" />
</template>
