<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AppHeader } from '@/widgets/header';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import {
  useReceiptWizard,
  StepProgressIndicator,
  Step1PhotoCapture,
  Step2EditItems,
  Step3AssignParticipants,
  Step4Summary,
} from '@/features/scan-receipt';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';

const STEP_LABELS = ['Фото чека', 'Позиции', 'Участники', 'Итог'];
const TOTAL_STEPS = STEP_LABELS.length;

const router = useRouter();
const { userId } = useCurrentUser();

const wizard = useReceiptWizard(() => userId.value);

const { accounts } = useAccounts(userId);
const { expenseCategories } = useCategories(userId);

const transitionName = computed(() =>
  wizard.direction.value === 'back' ? 'step-back' : 'step-forward',
);

function handleBack() {
  if (wizard.currentStep.value === 1) {
    router.back();
  } else {
    wizard.goBack();
  }
}
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
    <!-- Header -->
    <AppHeader show-back blur @back="handleBack">
      <template #left>
        <div class="min-w-0">
          <h1
            class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark leading-tight truncate"
          >
            Сканировать чек
          </h1>
          <div class="relative h-5 overflow-hidden">
            <Transition name="step-label">
              <p
                :key="wizard.currentStep.value"
                class="absolute inset-x-0 top-0 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                Шаг {{ wizard.currentStep.value }} из {{ TOTAL_STEPS }} ·
                {{ STEP_LABELS[wizard.currentStep.value - 1] }}
              </p>
            </Transition>
          </div>
        </div>
      </template>
    </AppHeader>

    <!-- Step Progress Indicator -->
    <StepProgressIndicator :current-step="wizard.currentStep.value" :total-steps="TOTAL_STEPS" />

    <!-- Step content area -->
    <div class="flex-1 overflow-hidden relative">
      <Transition :name="transitionName">
        <Step1PhotoCapture
          v-if="wizard.currentStep.value === 1"
          key="step-1"
          :preview-url="wizard.previewUrl.value"
          :is-ocr-loading="wizard.isOcrLoading.value"
          :is-ocr-success="wizard.isOcrSuccess.value"
          :ocr-error="wizard.ocrError.value"
          @select-file="wizard.selectFile"
          @reset-photo="wizard.resetPhoto"
          @retry-ocr="wizard.scanReceipt"
        />
        <Step2EditItems
          v-else-if="wizard.currentStep.value === 2"
          key="step-2"
          :items="wizard.items.value"
          :currency="wizard.currency.value"
          :subtotal="wizard.subtotal.value"
          :charges="wizard.charges.value"
          :charges-amount="wizard.chargesAmount.value"
          :total-amount="wizard.totalAmount.value"
          @update-item="wizard.updateItem"
          @delete-item="wizard.deleteItem"
          @add-item="wizard.addItem"
          @split-item="wizard.splitItem"
          @add-charge="wizard.addCharge"
          @remove-charge="wizard.removeCharge"
          @toggle-charge="wizard.toggleCharge"
          @update-charge-percent="wizard.updateChargePercent"
          @update-charge-amount="wizard.updateChargeAmount"
          @next="wizard.goNext"
          @back="wizard.goBack"
        />
        <Step3AssignParticipants
          v-else-if="wizard.currentStep.value === 3"
          key="step-3"
          :items="wizard.items.value"
          :participants="wizard.participants.value"
          :currency="wizard.currency.value"
          :has-me="wizard.hasMe.value"
          :unassigned-count="wizard.unassignedCount.value"
          :charges="wizard.charges.value"
          :subtotal="wizard.subtotal.value"
          @add-participant="wizard.addParticipant"
          @remove-participant="wizard.removeParticipant"
          @toggle-item-participant="wizard.toggleItemParticipant"
          @assign-all="wizard.assignAllTo"
          @next="wizard.goNext"
          @back="wizard.goBack"
        />
        <Step4Summary
          v-else-if="wizard.currentStep.value === 4"
          key="step-4"
          :participant-summaries="wizard.participantSummaries.value"
          :currency="wizard.currency.value"
          :form-data="wizard.formData.value"
          :accounts="accounts ?? []"
          :categories="expenseCategories"
          :subtotal="wizard.subtotal.value"
          :charges="wizard.charges.value"
          :charges-amount="wizard.chargesAmount.value"
          :total-amount="wizard.totalAmount.value"
          :store-name="wizard.storeName.value"
          :is-submitting="wizard.isSubmitting.value"
          :submit-error="wizard.submitError.value"
          :is-success="wizard.isSuccess.value"
          :is-form-valid="wizard.isFormValid.value"
          @update:form-data="(val) => (wizard.formData.value = val)"
          @submit="wizard.handleSubmit"
          @back="wizard.goBack"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* Step label crossfade */
.step-label-enter-active,
.step-label-leave-active {
  transition: opacity 150ms ease;
}
.step-label-enter-from,
.step-label-leave-to {
  opacity: 0;
}

/* Forward: new step slides in from the right */
.step-forward-enter-active,
.step-forward-leave-active {
  transition:
    transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  inset: 0;
  width: 100%;
}
.step-forward-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.step-forward-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}

/* Backward: new step slides in from the left */
.step-back-enter-active,
.step-back-leave-active {
  transition:
    transform 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  inset: 0;
  width: 100%;
}
.step-back-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.step-back-leave-to {
  transform: translateX(30%);
  opacity: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .step-forward-enter-active,
  .step-forward-leave-active,
  .step-back-enter-active,
  .step-back-leave-active {
    transition: opacity 150ms ease !important;
  }
  .step-forward-enter-from,
  .step-back-enter-from {
    transform: none !important;
  }
}
</style>
