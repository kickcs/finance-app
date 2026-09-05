import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useProfile } from '@/shared/api';
import { isValidCardNumber, normalizeCardNumber } from '@/shared/lib/format/cardNumber';

export interface ProfileFormData {
  name: string;
  /** Карта для переводов: её же предлагают приложить к шарингу долгов. */
  cardNumber: string;
}

export function useEditProfile(userId: MaybeRefOrGetter<string | null>) {
  const { profile, updateProfile } = useProfile(userId);

  const formData = ref<ProfileFormData>({
    name: '',
    cardNumber: '',
  });

  const isSubmitting = ref(false);

  /** Пустая карта — законное состояние: поле необязательное, его просто не заполнили. */
  const isCardValid = computed(
    () => formData.value.cardNumber.trim() === '' || isValidCardNumber(formData.value.cardNumber),
  );

  const isValid = computed(() => formData.value.name.trim().length > 0 && isCardValid.value);

  function initForm() {
    formData.value.name = profile.value?.name || '';
    formData.value.cardNumber = profile.value?.payment_card_number || '';
  }

  function updateField<K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]) {
    formData.value[field] = value;
  }

  async function saveProfile() {
    if (!isValid.value || isSubmitting.value) return;

    const uid = toValue(userId);
    if (!uid) return;

    isSubmitting.value = true;
    try {
      const cardNumber = normalizeCardNumber(formData.value.cardNumber);
      await updateProfile({
        name: formData.value.name.trim(),
        payment_card_number: cardNumber || null,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    formData,
    isValid,
    isCardValid,
    isSubmitting,
    initForm,
    updateField,
    saveProfile,
  };
}
