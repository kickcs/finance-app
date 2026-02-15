import { ref, computed } from 'vue';
import type { Reminder } from '@/entities/reminder';
import { REMINDER_ICONS } from '@/entities/reminder';
import { ACCOUNT_COLORS } from '@/entities/account';

export interface SubscriptionFormData {
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once';
  next_date: string;
  icon: string;
  color: string;
}

export function useEditSubscription() {
  const isOpen = ref(false);
  const isEditing = ref(false);
  const selectedSubscription = ref<Reminder | null>(null);
  const isSubmitting = ref(false);
  const isDeleting = ref(false);
  const showDeleteConfirm = ref(false);
  const error = ref<string | null>(null);

  const formData = ref<SubscriptionFormData>({
    name: '',
    amount: 0,
    frequency: 'monthly',
    next_date: '',
    icon: REMINDER_ICONS[0],
    color: ACCOUNT_COLORS[0],
  });

  const isFormValid = computed(() => {
    return formData.value.name.trim().length > 0 && formData.value.amount > 0;
  });

  function openModal(subscription: Reminder) {
    selectedSubscription.value = subscription;
    formData.value = {
      name: subscription.name,
      amount: subscription.amount,
      frequency: subscription.frequency,
      next_date: subscription.next_date.split('T')[0],
      icon: subscription.icon,
      color: subscription.color,
    };
    isEditing.value = false;
    showDeleteConfirm.value = false;
    error.value = null;
    isOpen.value = true;
  }

  function closeModal() {
    isOpen.value = false;
    isEditing.value = false;
    showDeleteConfirm.value = false;
    selectedSubscription.value = null;
    error.value = null;
  }

  function startEditing() {
    isEditing.value = true;
  }

  function cancelEditing() {
    if (selectedSubscription.value) {
      formData.value = {
        name: selectedSubscription.value.name,
        amount: selectedSubscription.value.amount,
        frequency: selectedSubscription.value.frequency,
        next_date: selectedSubscription.value.next_date.split('T')[0],
        icon: selectedSubscription.value.icon,
        color: selectedSubscription.value.color,
      };
    }
    isEditing.value = false;
    error.value = null;
  }

  function updateField<K extends keyof SubscriptionFormData>(
    field: K,
    value: SubscriptionFormData[K],
  ) {
    formData.value[field] = value;
  }

  function requestDelete() {
    showDeleteConfirm.value = true;
  }

  function cancelDelete() {
    showDeleteConfirm.value = false;
  }

  return {
    isOpen,
    isEditing,
    selectedSubscription,
    formData,
    isFormValid,
    isSubmitting,
    isDeleting,
    showDeleteConfirm,
    error,
    openModal,
    closeModal,
    startEditing,
    cancelEditing,
    updateField,
    requestDelete,
    cancelDelete,
  };
}
