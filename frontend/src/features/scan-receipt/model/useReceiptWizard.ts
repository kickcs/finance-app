import { ref } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import { usePhotoStep, type OcrResult } from './usePhotoStep';
import { useItemsStep, uid } from './useItemsStep';
import { useParticipantsStep } from './useParticipantsStep';
import { useSubmitStep } from './useSubmitStep';
import type { WizardDirection } from './types';

export function useReceiptWizard(userId: () => string | null) {
  const { trigger } = useHaptics();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 2: Items (delegated to useItemsStep)
  const itemsStep = useItemsStep();
  const { items, currency, storeName, charges, totalAmount, getItemWithChargesTotal } = itemsStep;

  // Step 3: Participants (delegated to useParticipantsStep)
  const participantsStep = useParticipantsStep(items);
  const { participants } = participantsStep;

  // Step 4: Submit (delegated to useSubmitStep)
  const submitStep = useSubmitStep(
    userId,
    items,
    participants,
    storeName,
    totalAmount,
    getItemWithChargesTotal,
  );
  const { formData } = submitStep;

  // Step navigation
  function goNext() {
    if (currentStep.value < 4) {
      direction.value = 'forward';
      currentStep.value++;
      trigger('selection');
    }
  }

  function goBack() {
    if (currentStep.value > 1) {
      direction.value = 'back';
      currentStep.value--;
      trigger('selection');
    }
  }

  // Step 1: Photo (delegated to usePhotoStep)
  function handleOcrResult(result: OcrResult) {
    items.value = result.items.map((item) => ({
      id: uid(),
      name: item.name,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      ocrTotalPrice: item.totalPrice ?? null,
      assignedParticipantIds: [],
    }));
    currency.value = result.currency;
    formData.value.currency = result.currency;
    storeName.value = result.storeName;

    // Seed charges from OCR serviceChargePercent
    const rawPercent = result.serviceChargePercent;
    if (rawPercent && rawPercent >= 0.1) {
      charges.value = [{ id: uid(), label: 'Обслуживание', percent: rawPercent, enabled: true }];
    } else {
      charges.value = [];
    }

    // Use hashtags from OCR for description, fallback to store name
    if (result.hashtags?.length > 0) {
      formData.value.description = result.hashtags.join(' ');
    } else if (result.storeName) {
      formData.value.description = `#${result.storeName.replace(/[^a-zа-яёA-ZА-ЯЁ0-9]/g, '').toLowerCase()}`;
    }
    if (result.date) {
      formData.value.date = new Date(result.date).getTime();
    }
  }

  const photoStep = usePhotoStep(handleOcrResult, goNext);

  return {
    // Step state
    currentStep,
    direction,
    goNext,
    goBack,
    // Step 1
    ...photoStep,
    // Step 2
    ...itemsStep,
    // Step 3
    ...participantsStep,
    // Step 4
    ...submitStep,
  };
}
