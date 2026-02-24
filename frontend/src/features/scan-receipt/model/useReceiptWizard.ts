import { ref, computed, onUnmounted } from 'vue';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { receiptApi, type ScanReceiptResponse } from '../api/receiptApi';
import { transactionsApi } from '@/entities/transaction';
import { debtsApi, debtQueryKeys } from '@/entities/debt';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useQueryClient } from '@tanstack/vue-query';
import { haptics } from '@/shared/lib/haptics';
import { calcLineTotal, calcLineTotalWithService } from './calcLineTotal';
import type {
  ReceiptItem,
  Participant,
  ParticipantSummary,
  ScanReceiptFormData,
  WizardDirection,
} from './types';

let nextId = 0;
function uid(): string {
  return `ri_${++nextId}_${Date.now()}`;
}

export function useReceiptWizard(userId: () => string | null) {
  const queryClient = useQueryClient();

  // Step state
  const currentStep = ref(1);
  const direction = ref<WizardDirection>('forward');

  // Step 1: Photo
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isOcrLoading = ref(false);
  const isOcrSuccess = ref(false);
  const ocrError = ref<string | null>(null);

  // Step 2: Items
  const items = ref<ReceiptItem[]>([]);
  const currency = ref('UZS');
  const storeName = ref<string | null>(null);
  const receiptDate = ref<string | null>(null);
  const serviceChargePercent = ref<number | null>(null);

  // Step 3: Participants
  const participants = ref<Participant[]>([]);

  // Step 4: Form
  const formData = ref<ScanReceiptFormData>({
    accountId: null,
    categoryId: '',
    description: '',
    date: Date.now(),
    createDebts: true,
    currency: 'UZS',
  });
  const isSubmitting = ref(false);
  const submitError = ref<string | null>(null);
  const isSuccess = ref(false);

  // Computed
  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + calcLineTotal(item), 0),
  );

  const serviceChargeAmount = computed(() => {
    if (!serviceChargePercent.value) return 0;
    return Math.round(subtotal.value * serviceChargePercent.value / 100);
  });

  const totalAmount = computed(() => subtotal.value + serviceChargeAmount.value);

  // Per-item service-inclusive price (proportionally distributed)
  function getItemWithServiceTotal(item: ReceiptItem): number {
    return calcLineTotalWithService(item, serviceChargePercent.value);
  }

  const unassignedCount = computed(() =>
    items.value.filter((item) => item.assignedParticipantIds.length === 0).length,
  );

  const participantSummaries = computed<ParticipantSummary[]>(() => {
    return participants.value.map((p) => {
      const assignedItems = items.value
        .filter((item) => item.assignedParticipantIds.includes(p.id))
        .map((item) => {
          const sharedWith = item.assignedParticipantIds.length;
          // Use service-inclusive total for splitting
          const lineTotal = getItemWithServiceTotal(item);
          const isLast =
            item.assignedParticipantIds[item.assignedParticipantIds.length - 1] === p.id;
          const baseShare = Math.floor(lineTotal / sharedWith);
          // Last participant absorbs the remainder to preserve exact total
          const share = isLast
            ? lineTotal - baseShare * (sharedWith - 1)
            : baseShare;
          return {
            id: item.id,
            name: item.name,
            lineTotal,
            share,
            sharedWith,
          };
        });

      return {
        id: p.id,
        name: p.name,
        isMe: p.isMe,
        color: p.color,
        itemCount: assignedItems.length,
        total: assignedItems.reduce((sum, i) => sum + i.share, 0),
        items: assignedItems,
      };
    });
  });

  // Step navigation
  function goNext() {
    if (currentStep.value < 4) {
      direction.value = 'forward';
      currentStep.value++;
      haptics.tap();
    }
  }

  function goBack() {
    if (currentStep.value > 1) {
      direction.value = 'back';
      currentStep.value--;
      haptics.tap();
    }
  }

  // Step 1: Photo handling
  function selectFile(file: File) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
    ocrError.value = null;
    scanReceipt();
  }

  function resetPhoto() {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    selectedFile.value = null;
    previewUrl.value = null;
    isOcrLoading.value = false;
    isOcrSuccess.value = false;
    ocrError.value = null;
  }

  async function scanReceipt() {
    if (!selectedFile.value) return;
    isOcrLoading.value = true;
    ocrError.value = null;

    try {
      const result: ScanReceiptResponse = await receiptApi.scan(selectedFile.value);

      // Filter out service charge / tax / discount line items that GPT may still return
      const serviceKeywords = /обслуживание|service|чаевые|tip|ндс|vat|tax|скидка|discount|delivery|доставка/i;
      const productItems = result.items.filter(
        (item) => !serviceKeywords.test(item.name),
      );

      items.value = productItems.map((item) => ({
        id: uid(),
        name: item.name,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        assignedParticipantIds: [],
      }));
      currency.value = result.currency;
      formData.value.currency = result.currency;
      storeName.value = result.storeName;
      receiptDate.value = result.date;

      // Only use serviceChargePercent if it's meaningful (>= 0.1%)
      const rawPercent = result.serviceChargePercent;
      serviceChargePercent.value = rawPercent && rawPercent >= 0.1 ? rawPercent : null;
      // Use hashtags from OCR for description, fallback to store name
      if (result.hashtags?.length > 0) {
        formData.value.description = result.hashtags.join(' ');
      } else if (result.storeName) {
        formData.value.description = `#${result.storeName.replace(/[^a-zа-яёA-ZА-ЯЁ0-9]/g, '').toLowerCase()}`;
      }
      if (result.date) {
        formData.value.date = new Date(result.date).getTime();
      }
      isOcrSuccess.value = true;
      haptics.success();
      // Auto-advance after 600ms
      setTimeout(() => goNext(), 600);
    } catch (error) {
      ocrError.value = error instanceof Error ? error.message : 'Не удалось распознать чек';
      haptics.error();
    } finally {
      isOcrLoading.value = false;
    }
  }

  // Step 2: Item editing
  function updateItem(id: string, updates: Partial<ReceiptItem>) {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], ...updates };
    }
  }

  function deleteItem(id: string) {
    items.value = items.value.filter((i) => i.id !== id);
    haptics.warning();
  }

  function addItem(): string {
    const id = uid();
    items.value.push({
      id,
      name: '',
      qty: 1,
      unitPrice: 0,
      assignedParticipantIds: [],
    });
    haptics.tap();
    return id;
  }

  // Step 3: Participants
  function addParticipant(name: string, isMe = false) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: uid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex] as string,
    });
    haptics.tap();
  }

  function removeParticipant(id: string) {
    participants.value = participants.value.filter((p) => p.id !== id);
    // Remove from all item assignments
    items.value.forEach((item) => {
      item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
    });
    haptics.warning();
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;
    const idx = item.assignedParticipantIds.indexOf(participantId);
    if (idx === -1) {
      item.assignedParticipantIds.push(participantId);
    } else {
      item.assignedParticipantIds.splice(idx, 1);
    }
    haptics.tap();
  }

  const hasMe = computed(() => participants.value.some((p) => p.isMe));

  // Step 4: Submit
  async function handleSubmit() {
    const uid_ = userId();
    if (!uid_ || !formData.value.accountId || !formData.value.categoryId) return;

    isSubmitting.value = true;
    submitError.value = null;

    try {
      // Create the main expense transaction
      const transaction = await transactionsApi.create({
        user_id: uid_,
        account_id: formData.value.accountId,
        category_id: formData.value.categoryId,
        amount: totalAmount.value,
        currency: formData.value.currency,
        type: 'expense',
        description: formData.value.description || null,
        date: new Date(formData.value.date).toISOString(),
      });

      // Create debts for non-me participants
      if (formData.value.createDebts) {
        const nonMeSummaries = participantSummaries.value.filter((p) => !p.isMe && p.total > 0);
        for (const summary of nonMeSummaries) {
          await debtsApi.create({
            user_id: uid_,
            name: `Чек: ${storeName.value || 'Без названия'}`,
            total_amount: summary.total,
            remaining_amount: summary.total,
            debt_type: 'given',
            person_name: summary.name,
            account_id: formData.value.accountId,
            currency: formData.value.currency,
            source_transaction_id: transaction.id,
          });
        }
      }

      // Invalidate caches
      invalidateTransactionRelated(queryClient, uid_);
      invalidateAccountRelated(queryClient, uid_);
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid_) });

      isSuccess.value = true;
      haptics.success();
    } catch (error) {
      console.error('Receipt submit failed:', error);
      submitError.value = error instanceof Error ? error.message : 'Произошла ошибка';
      haptics.error();
    } finally {
      isSubmitting.value = false;
    }
  }

  const isFormValid = computed(
    () => !!formData.value.accountId && !!formData.value.categoryId && totalAmount.value > 0,
  );

  onUnmounted(() => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  });

  return {
    // Step state
    currentStep,
    direction,
    goNext,
    goBack,
    // Step 1
    selectedFile,
    previewUrl,
    isOcrLoading,
    isOcrSuccess,
    ocrError,
    selectFile,
    resetPhoto,
    scanReceipt,
    // Step 2
    items,
    currency,
    storeName,
    receiptDate,
    subtotal,
    serviceChargePercent,
    serviceChargeAmount,
    totalAmount,
    getItemWithServiceTotal,
    updateItem,
    deleteItem,
    addItem,
    // Step 3
    participants,
    hasMe,
    unassignedCount,
    addParticipant,
    removeParticipant,
    toggleItemParticipant,
    // Step 4
    formData,
    participantSummaries,
    isSubmitting,
    submitError,
    isSuccess,
    isFormValid,
    handleSubmit,
  };
}
