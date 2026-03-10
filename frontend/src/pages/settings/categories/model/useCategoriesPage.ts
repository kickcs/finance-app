import { ref, computed, watch } from 'vue';
import { useCategories } from '@/entities/category';
import type { UserCategory } from '@/shared/api/database.types';
import { useManageCategories } from '@/features/manage-categories';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';

export const TAB_ITEMS = [
  { id: 'expense', label: 'Расходы', icon: 'trending_down' },
  { id: 'income', label: 'Доходы', icon: 'trending_up' },
] as const;

export function useCategoriesPage() {
  const { userId } = useCurrentUser();
  const { trigger } = useHaptics();
  const { categories, createCategory, updateCategory, reorderCategories, isLoading } =
    useCategories(userId);
  const { formData, isValid, isSubmitting, resetForm, updateField } = useManageCategories();

  // Tab state
  const activeTab = ref<'expense' | 'income'>('expense');

  // Category lists split by frequency
  const localFrequentCategories = ref<UserCategory[]>([]);
  const localInfrequentCategories = ref<UserCategory[]>([]);
  const showInfrequent = ref(false);

  watch(
    [categories, activeTab],
    ([cats, tab]) => {
      const filtered = cats.filter((c) => c.type === tab);
      localFrequentCategories.value = filtered.filter((c) => c.is_frequent !== false);
      localInfrequentCategories.value = filtered.filter((c) => c.is_frequent === false);
    },
    { immediate: true },
  );

  const infrequentCount = computed(() => localInfrequentCategories.value.length);

  // Modal state
  const showFormModal = ref(false);
  const editingCategory = ref<UserCategory | null>(null);

  const isEditMode = computed(() => editingCategory.value !== null);
  const modalTitle = computed(() => {
    if (isEditMode.value) return 'Редактирование категории';
    return `Новая категория ${activeTab.value === 'expense' ? 'расходов' : 'доходов'}`;
  });

  // Actions
  async function toggleFrequent(id: string, isFrequent: boolean) {
    trigger('selection');
    await updateCategory(id, { is_frequent: isFrequent });
  }

  async function handleDragEnd() {
    const categoryIds = localFrequentCategories.value.map((c) => c.id);
    try {
      await reorderCategories(categoryIds);
    } catch (error) {
      console.error('Failed to reorder categories:', error);
    }
  }

  function goBack() {
    navigateBack();
  }

  function openAddModal() {
    editingCategory.value = null;
    resetForm(activeTab.value);
    showFormModal.value = true;
  }

  function openEditModal(category: UserCategory) {
    editingCategory.value = category;
    formData.value = {
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
    };
    showFormModal.value = true;
  }

  function closeFormModal() {
    showFormModal.value = false;
    editingCategory.value = null;
  }

  async function handleSave() {
    if (!isValid.value || isSubmitting.value) return;

    isSubmitting.value = true;
    try {
      if (isEditMode.value && editingCategory.value) {
        await updateCategory(editingCategory.value.id, {
          name: formData.value.name.trim(),
          icon: formData.value.icon,
          color: formData.value.color,
        });
      } else {
        await createCategory({
          name: formData.value.name.trim(),
          icon: formData.value.icon,
          color: formData.value.color,
          type: formData.value.type,
        });
      }
      closeFormModal();
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    // State
    activeTab,
    isLoading,
    localFrequentCategories,
    localInfrequentCategories,
    showInfrequent,
    infrequentCount,
    // Modal
    showFormModal,
    isEditMode,
    modalTitle,
    formData,
    isValid,
    isSubmitting,
    updateField,
    // Actions
    toggleFrequent,
    handleDragEnd,
    goBack,
    openAddModal,
    openEditModal,
    closeFormModal,
    handleSave,
  };
}
