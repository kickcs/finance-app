<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import { UButton, UIcon, UCard, UTabs, UModal, Skeleton, EmptyState, IconBadge } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';

const draggable = defineAsyncComponent(() => import('vuedraggable'));
import { useCategories } from '@/entities/category';
import type { UserCategory } from '@/shared/api/database.types';
import { CategoryForm, useManageCategories } from '@/features/manage-categories';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const { userId } = useCurrentUser();

// Categories composable - now all categories come from DB
const { categories, createCategory, updateCategory, deleteCategory, reorderCategories, isLoading } =
  useCategories(userId);

// Form state
const { formData, isValid, isSubmitting, resetForm, updateField } = useManageCategories();

const tabItems = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

const activeTab = ref<'expense' | 'income'>('expense');

// Modal states
const showFormModal = ref(false);
const showDeleteModal = ref(false);
const editingCategory = ref<UserCategory | null>(null);
const categoryToDelete = ref<{ id: string; name: string } | null>(null);

// Mode: 'create' or 'edit'
const isEditMode = computed(() => editingCategory.value !== null);
const modalTitle = computed(() => {
  if (isEditMode.value) {
    return 'Редактирование категории';
  }
  return `Новая категория ${activeTab.value === 'expense' ? 'расходов' : 'доходов'}`;
});

// Local mutable list for draggable (filtered by type)
const localCategories = ref<UserCategory[]>([]);

// Watch categories and activeTab to update local list
watch(
  [categories, activeTab],
  ([cats, tab]) => {
    localCategories.value = cats.filter((c) => c.type === tab);
  },
  { immediate: true },
);

// Handle drag end - save new order
async function handleDragEnd() {
  // Get all category IDs in new order
  const categoryIds = localCategories.value.map((c) => c.id);
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
      // Update existing category
      await updateCategory(editingCategory.value.id, {
        name: formData.value.name.trim(),
        icon: formData.value.icon,
        color: formData.value.color,
      });
    } else {
      // Create new category
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

function openDeleteModal(category: UserCategory) {
  categoryToDelete.value = { id: category.id, name: category.name };
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  categoryToDelete.value = null;
}

async function confirmDelete() {
  if (!categoryToDelete.value) return;

  try {
    await deleteCategory(categoryToDelete.value.id);
    closeDeleteModal();
  } catch (error) {
    console.error('Failed to delete category:', error);
  }
}
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
    <!-- Header -->
    <AppHeader blur show-back title="Категории" class="shrink-0" @back="goBack">
      <template #actions>
        <UButton variant="ghost" size="sm" class="!p-2" @click="openAddModal">
          <UIcon name="add" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-5 pt-8 pb-10 space-y-4">
      <!-- Tabs -->
      <UTabs v-model="activeTab" :items="tabItems" />

      <!-- Loading state -->
      <div v-if="isLoading" class="flex justify-center py-8">
        <Skeleton class="h-8 w-8 rounded-full" />
      </div>

      <!-- Categories List with Drag and Drop -->
      <UCard v-else-if="localCategories.length > 0" variant="bordered" class="overflow-hidden">
        <draggable
          v-model="localCategories"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-50"
          animation="200"
          class="divide-y divide-border-light dark:divide-border-dark"
          @end="handleDragEnd"
        >
          <template #item="{ element: category }">
            <div
              class="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
            >
              <!-- Drag Handle -->
              <div
                class="drag-handle cursor-grab active:cursor-grabbing text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors"
              >
                <UIcon name="drag_indicator" size="sm" />
              </div>

              <!-- Category Icon -->
              <IconBadge :icon="category.icon" size="sm" :color="category.color" class="shrink-0" />

              <!-- Category Name -->
              <span
                class="flex-1 font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ category.name }}
              </span>

              <!-- Action Buttons -->
              <div class="flex shrink-0 gap-1 -mr-2">
                <UButton
                  variant="icon"
                  class="text-text-secondary-light dark:text-text-secondary-dark hover:bg-border-light dark:hover:bg-border-dark rounded-xl"
                  @click="openEditModal(category)"
                >
                  <UIcon name="edit" size="sm" />
                </UButton>
                <UButton
                  variant="icon"
                  class="text-danger hover:bg-danger/10 rounded-xl"
                  @click="openDeleteModal(category)"
                >
                  <UIcon name="delete" size="sm" />
                </UButton>
              </div>
            </div>
          </template>
        </draggable>
      </UCard>

      <!-- Empty state -->
      <UCard v-else variant="bordered" class="py-4">
        <EmptyState
          icon="category"
          title="Нет категорий"
          description="Добавьте свои категории для лучшего учета финансов"
          :action="{ label: 'Добавить', onClick: openAddModal }"
        />
      </UCard>

      <!-- Add Category Button -->
      <UButton
        v-if="!isLoading"
        variant="ghost"
        full-width
        class="!justify-center !gap-2 !p-4 !rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary hover:text-primary"
        @click="openAddModal"
      >
        <UIcon name="add" size="md" />
        <span class="font-medium">Добавить категорию</span>
      </UButton>
    </main>

    <!-- Add/Edit Category Modal -->
    <UModal v-model="showFormModal" :title="modalTitle" @close="closeFormModal">
      <CategoryForm
        :form-data="formData"
        @update:name="updateField('name', $event)"
        @update:icon="updateField('icon', $event)"
        @update:color="updateField('color', $event)"
      />

      <template #actions>
        <UButton variant="secondary" full-width @click="closeFormModal">Отмена</UButton>
        <UButton
          variant="primary"
          full-width
          :disabled="!isValid || isSubmitting"
          @click="handleSave"
        >
          {{ isSubmitting ? 'Сохранение...' : isEditMode ? 'Сохранить' : 'Создать' }}
        </UButton>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal" title="Удалить категорию" @close="closeDeleteModal">
      <p class="text-text-secondary-light dark:text-text-secondary-dark">
        Вы уверены, что хотите удалить категорию "{{ categoryToDelete?.name }}"?
      </p>

      <template #actions>
        <UButton variant="secondary" full-width @click="closeDeleteModal">Отмена</UButton>
        <UButton
          variant="primary"
          full-width
          class="!bg-danger hover:!bg-danger/90"
          @click="confirmDelete"
        >
          Удалить
        </UButton>
      </template>
    </UModal>
  </div>
</template>
