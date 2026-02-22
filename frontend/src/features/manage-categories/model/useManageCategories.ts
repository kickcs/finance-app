import { ref, computed } from 'vue';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './constants';

export interface CategoryFormData {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}

export function useManageCategories() {
  const formData = ref<CategoryFormData>({
    name: '',
    icon: CATEGORY_ICONS[0],
    color: CATEGORY_COLORS[0],
    type: 'expense',
  });

  const isSubmitting = ref(false);

  const isValid = computed(() => formData.value.name.trim().length > 0);

  const nameError = computed(() => {
    const name = formData.value.name;
    if (name.length > 0 && name.trim().length === 0) {
      return 'Название не может состоять только из пробелов';
    }
    return null;
  });

  function resetForm(type: 'expense' | 'income' = 'expense') {
    formData.value = {
      name: '',
      icon: CATEGORY_ICONS[0],
      color: CATEGORY_COLORS[0],
      type,
    };
  }

  function updateField<K extends keyof CategoryFormData>(field: K, value: CategoryFormData[K]) {
    formData.value[field] = value;
  }

  return {
    formData,
    isValid,
    isSubmitting,
    nameError,
    resetForm,
    updateField,
  };
}
