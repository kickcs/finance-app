<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import {
  UButton,
  UIcon,
  UCard,
  UModal,
  SkeletonListItem,
  EmptyState,
  IconBadge,
  SwipeableItem,
} from '@/shared/ui';
import { useSlidingIndicator, buildIndicatorRect } from '@/shared/lib/hooks/useSlidingIndicator';
import { AppHeader } from '@/widgets/header';
import { CategoryForm } from '@/features/manage-categories';
import { useCategoriesPage, TAB_ITEMS } from './model/useCategoriesPage';

const draggable = defineAsyncComponent(() => import('vuedraggable'));

const {
  activeTab,
  isLoading,
  localFrequentCategories,
  localInfrequentCategories,
  showInfrequent,
  infrequentCount,
  showFormModal,
  isEditMode,
  modalTitle,
  formData,
  isValid,
  isSubmitting,
  updateField,
  toggleFrequent,
  handleDragEnd,
  goBack,
  openAddModal,
  openEditModal,
  closeFormModal,
  handleSave,
} = useCategoriesPage();

const categoryCardClass =
  'flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card-light dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50 shadow-sm';

// Sliding indicator (needs template ref — stays in component)
const typeChipsRef = ref<HTMLElement | null>(null);
const { setChipRef: setTypeChipRef, indicatorStyle: typeIndicatorStyle } = useSlidingIndicator(
  typeChipsRef,
  () => activeTab.value,
  (containerRect, activeRect, scrollLeft, scrollTop) => ({
    ...buildIndicatorRect(containerRect, activeRect, scrollLeft, scrollTop),
    backgroundColor: 'var(--color-primary)',
    borderRadius: '9999px',
  }),
);
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
    <main class="flex-1 overflow-y-auto px-5 pt-8 pb-28 space-y-4">
      <!-- Type Chips -->
      <div ref="typeChipsRef" class="relative flex gap-2">
        <!-- Sliding Indicator -->
        <span
          class="absolute rounded-full pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 shadow-sm"
          :style="typeIndicatorStyle"
        />

        <button
          v-for="tab in TAB_ITEMS"
          :key="tab.id"
          :ref="(el) => setTypeChipRef(tab.id, el as HTMLElement)"
          :class="[
            'relative z-10 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium',
            'transition-colors duration-300',
            activeTab === tab.id
              ? 'text-white'
              : [
                  'bg-surface-light dark:bg-surface-dark',
                  'text-text-primary-light dark:text-text-primary-dark',
                  'active:bg-border-light dark:active:bg-border-dark',
                ],
          ]"
          @click="activeTab = tab.id as 'expense' | 'income'"
        >
          <UIcon :name="tab.icon" size="sm" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="space-y-2">
        <div v-for="i in 5" :key="i" :class="categoryCardClass">
          <SkeletonListItem :show-trailing="false" avatar-class="w-9 h-9 rounded-xl" />
        </div>
      </div>

      <!-- Frequent Categories -->
      <template
        v-else-if="localFrequentCategories.length > 0 || localInfrequentCategories.length > 0"
      >
        <draggable
          v-if="localFrequentCategories.length > 0"
          v-model="localFrequentCategories"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-50"
          animation="200"
          class="space-y-2"
          @end="handleDragEnd"
        >
          <template #item="{ element: category }">
            <SwipeableItem
              :left-action="{ icon: 'visibility_off', color: '#f59e0b', label: 'Скрыть' }"
              @action-left="toggleFrequent(category.id, false)"
              @action-right="openEditModal(category)"
            >
              <div :class="categoryCardClass">
                <!-- Drag Handle -->
                <div
                  class="drag-handle cursor-grab active:cursor-grabbing text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  <UIcon name="drag_indicator" size="sm" />
                </div>

                <!-- Category Icon -->
                <IconBadge
                  :icon="category.icon"
                  size="sm"
                  :color="category.color"
                  class="shrink-0"
                />

                <!-- Category Name -->
                <span
                  class="flex-1 font-medium text-text-primary-light dark:text-text-primary-dark truncate"
                >
                  {{ category.name }}
                </span>
              </div>
            </SwipeableItem>
          </template>
        </draggable>

        <!-- Infrequent Categories Section -->
        <div v-if="infrequentCount > 0" class="space-y-2">
          <button
            class="flex items-center gap-2 w-full px-1 py-2 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
            @click="showInfrequent = !showInfrequent"
          >
            <UIcon
              name="expand_more"
              size="sm"
              class="transition-transform duration-200"
              :class="showInfrequent ? 'rotate-180' : ''"
            />
            Редко используемые ({{ infrequentCount }})
          </button>

          <div v-if="showInfrequent" class="space-y-2">
            <SwipeableItem
              v-for="category in localInfrequentCategories"
              :key="category.id"
              :left-action="{ icon: 'visibility', color: '#22c55e', label: 'Показать' }"
              @action-left="toggleFrequent(category.id, true)"
              @action-right="openEditModal(category)"
            >
              <div :class="[categoryCardClass, 'opacity-60']">
                <!-- Category Icon -->
                <IconBadge
                  :icon="category.icon"
                  size="sm"
                  :color="category.color"
                  class="shrink-0"
                />

                <!-- Category Name -->
                <span
                  class="flex-1 font-medium text-text-primary-light dark:text-text-primary-dark truncate"
                >
                  {{ category.name }}
                </span>
              </div>
            </SwipeableItem>
          </div>
        </div>
      </template>

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
  </div>
</template>
