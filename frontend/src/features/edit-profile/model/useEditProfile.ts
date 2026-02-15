import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useProfile } from '@/shared/api';

export interface ProfileFormData {
  name: string;
}

export function useEditProfile(userId: MaybeRefOrGetter<string | null>) {
  const { profile, updateProfile } = useProfile(userId);

  const formData = ref<ProfileFormData>({
    name: '',
  });

  const isSubmitting = ref(false);

  const isValid = computed(() => formData.value.name.trim().length > 0);

  function initForm() {
    formData.value.name = profile.value?.name || '';
  }

  function updateField<K extends keyof ProfileFormData>(
    field: K,
    value: ProfileFormData[K],
  ) {
    formData.value[field] = value;
  }

  async function saveProfile() {
    if (!isValid.value || isSubmitting.value) return;

    const uid = toValue(userId);
    if (!uid) return;

    isSubmitting.value = true;
    try {
      await updateProfile({ name: formData.value.name.trim() });
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    formData,
    isValid,
    isSubmitting,
    initForm,
    updateField,
    saveProfile,
  };
}
