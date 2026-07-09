import { ref, watch } from 'vue';
import { watchDebounced } from '@vueuse/core';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/ui';
import { usePhotoStep, type OcrResult } from './usePhotoStep';
import { useItemsStep } from './useItemsStep';
import { uid } from './uid';
import { useParticipantsStep } from './useParticipantsStep';
import { useLastParty } from './useLastParty';
import { useReceiptDraft } from './useReceiptDraft';
import { useSubmitStep } from './useSubmitStep';
import type { WizardDirection } from './types';

export function useReceiptWizard(
  userId: () => string | null,
  /** Optional Telegram-imported op id to confirm once the receipt is submitted. */
  importedId: () => string | null = () => null,
) {
  const { trigger } = useHaptics();
  const { toast } = useToast();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 2: Items (delegated to useItemsStep)
  const itemsStep = useItemsStep();
  const {
    items,
    currency,
    storeName,
    charges,
    totalAmount,
    getItemWithChargesTotal,
    setOcrTotalAmount,
  } = itemsStep;

  // Step 3: Participants (delegated to useParticipantsStep)
  const participantsStep = useParticipantsStep(items);
  const { participants } = participantsStep;

  // «Как в прошлый раз» — состав участников последнего сохранённого чека
  const { lastParty, saveParty } = useLastParty();

  function restoreLastParty() {
    const party = lastParty.value;
    if (!party) return;
    participantsStep.restoreParty(party.members);
  }

  // Step 4: Submit (delegated to useSubmitStep)
  const submitStep = useSubmitStep(
    userId,
    items,
    participants,
    storeName,
    totalAmount,
    getItemWithChargesTotal,
    importedId,
  );
  const { formData } = submitStep;

  // Черновик: переживает случайное закрытие страницы (с шага 2 и дальше)
  const draftStore = useReceiptDraft();
  const { freshDraft } = draftStore;

  watchDebounced(
    [items, charges, participants, formData, currentStep],
    () => {
      if (currentStep.value < 2 || submitStep.isSuccess.value) return;
      draftStore.save({
        step: currentStep.value,
        items: items.value,
        currency: currency.value,
        storeName: storeName.value,
        ocrTotalAmount: itemsStep.ocrTotalAmount.value,
        charges: charges.value,
        totalAmount: totalAmount.value,
        participants: participants.value,
        payerId: submitStep.payerId.value,
        formData: formData.value,
        manualMode: manualMode.value,
      });
    },
    { debounce: 500, deep: true },
  );

  function restoreDraft() {
    const draft = freshDraft.value;
    if (!draft) return;
    items.value = draft.items;
    currency.value = draft.currency;
    storeName.value = draft.storeName;
    itemsStep.setOcrTotalAmount(draft.ocrTotalAmount);
    charges.value = draft.charges;
    participants.value = draft.participants;
    submitStep.payerId.value = draft.payerId;
    formData.value = draft.formData;
    manualMode.value = draft.manualMode;
    direction.value = 'forward';
    currentStep.value = Math.min(Math.max(draft.step, 2), 4);
    trigger('selection');
  }

  function discardDraft() {
    draftStore.clear();
  }

  // Успешный сабмит — запоминаем состав компании и очищаем черновик
  watch(submitStep.isSuccess, (success) => {
    if (success) {
      saveParty(participants.value);
      draftStore.clear();
    }
  });

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
    setOcrTotalAmount(result.totalAmount);

    // Seed charges from OCR. Prefer flat amount when present (preserves exact value);
    // fall back to percent when only that is given.
    if (result.serviceChargeAmount && result.serviceChargeAmount > 0) {
      charges.value = [
        {
          id: uid(),
          label: 'Обслуживание',
          type: 'amount',
          amount: result.serviceChargeAmount,
          enabled: true,
        },
      ];
    } else if (result.serviceChargePercent && result.serviceChargePercent >= 0.1) {
      charges.value = [
        {
          id: uid(),
          label: 'Обслуживание',
          type: 'percent',
          percent: result.serviceChargePercent,
          enabled: true,
        },
      ];
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

  // Ручной режим: без фото и OCR — сразу к позициям с одной пустой строкой
  const manualMode = ref(false);

  function startManualMode(defaultCurrency: string) {
    manualMode.value = true;
    currency.value = defaultCurrency;
    formData.value.currency = defaultCurrency;
    setOcrTotalAmount(null);
    if (items.value.length === 0) {
      itemsStep.addItem();
    }
    goNext();
  }

  // Удаление участника сбрасывает его и как выбранного плательщика чека
  function removeParticipantAndSyncPayer(id: string) {
    participantsStep.removeParticipant(id);
    if (submitStep.payerId.value === id) {
      submitStep.payerId.value = null;
    }
  }

  // Мягкое удаление позиции: тост с «Вернуть» на прежний индекс
  function deleteItemWithUndo(id: string) {
    const snapshot = itemsStep.deleteItem(id);
    if (!snapshot) return;
    toast({
      title: 'Позиция удалена',
      action: {
        label: 'Вернуть',
        onClick: () => itemsStep.restoreItem(snapshot.item, snapshot.index),
      },
    });
  }

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
    // «Как в прошлый раз»
    lastParty,
    restoreLastParty,
    // Ручной режим
    manualMode,
    startManualMode,
    // Черновик
    freshDraft,
    restoreDraft,
    discardDraft,
    // Overrides
    deleteItem: deleteItemWithUndo,
    removeParticipant: removeParticipantAndSyncPayer,
  };
}
