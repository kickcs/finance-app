<script setup lang="ts">
import { ref, computed } from 'vue';
import { AppHeader } from '@/widgets/header';
import {
  UButton,
  UIcon,
  UModal,
  UInput,
  UColorPicker,
  EmptyState,
  SwipeableItem,
  ConfirmDeleteModal,
  InitialAvatar,
  Skeleton,
  useToast,
} from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { usePeople, type Person } from '@/entities/person';
import { listTransition } from '@/shared/lib/transitions';
import { ENTITY_COLORS, getRandomEntityColor } from '@/shared/config/colors';
import { useHaptics } from '@/shared/lib/haptics';

const { trigger } = useHaptics();

const { userId } = useCurrentUser();
const { people, isLoading, createPerson, updatePerson, deletePerson } = usePeople(userId);
const { toast } = useToast();

// Sorted list
const sortedPeople = computed(() => {
  return [...people.value].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
});

// Modal state
const showModal = ref(false);
const editingPerson = ref<Person | null>(null);
const formName = ref('');
const formColor = ref<string>(ENTITY_COLORS[0]);
const isSaving = ref(false);

// Delete confirmation
const personToDelete = ref<Person | null>(null);

function openAddModal() {
  editingPerson.value = null;
  formName.value = '';
  formColor.value = getRandomEntityColor();
  showModal.value = true;
  trigger('selection');
}

function openEditModal(person: Person) {
  editingPerson.value = person;
  formName.value = person.name;
  formColor.value = person.color;
  showModal.value = true;
  trigger('selection');
}

async function handleSave() {
  const name = formName.value.trim();
  if (!name) return;

  isSaving.value = true;
  try {
    if (editingPerson.value) {
      await updatePerson(editingPerson.value.id, { name, color: formColor.value });
      toast({ title: 'Контакт обновлён', variant: 'success' });
    } else {
      await createPerson({ name, color: formColor.value });
      toast({ title: 'Контакт добавлен', variant: 'success' });
    }
    showModal.value = false;
  } catch {
    toast({ title: 'Не удалось сохранить', variant: 'error' });
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete() {
  if (!personToDelete.value) return;
  try {
    await deletePerson(personToDelete.value.id);
    toast({ title: 'Контакт удалён', variant: 'success' });
  } catch {
    toast({ title: 'Не удалось удалить', variant: 'error' });
  } finally {
    personToDelete.value = null;
  }
}
</script>

<template>
  <div
    class="h-dvh flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden"
  >
    <AppHeader blur show-back title="Люди" @back="navigateBack()" />

    <main class="flex-1 overflow-y-auto px-4 pt-6 pb-32">
      <!-- Loading skeleton -->
      <template v-if="isLoading">
        <div data-testid="people-loading" class="mb-5 px-1">
          <Skeleton class="h-4 w-36 rounded" />
        </div>
        <div class="space-y-3">
          <div
            v-for="i in 5"
            :key="i"
            class="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-card-light dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50"
          >
            <Skeleton class="w-11 h-11 rounded-full flex-shrink-0" />
            <Skeleton class="h-5 rounded flex-1" :style="{ maxWidth: `${120 + i * 20}px` }" />
          </div>
        </div>
      </template>

      <template v-else>
        <!-- Header stats -->
        <div
          v-if="sortedPeople.length > 0"
          data-testid="people-count"
          class="mb-5 flex items-center justify-between px-1"
        >
          <h2 class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Всего контактов: {{ sortedPeople.length }}
          </h2>
        </div>

        <!-- People list -->
        <TransitionGroup
          v-if="sortedPeople.length > 0"
          v-bind="listTransition"
          tag="div"
          data-testid="people-list"
          class="space-y-3 relative"
        >
          <div
            v-for="person in sortedPeople"
            :key="person.id"
            data-testid="person-item"
            class="group list-item-wrapper"
          >
            <SwipeableItem
              @action-left="personToDelete = person"
              @action-right="openEditModal(person)"
            >
              <button
                class="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-card-light dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50 shadow-sm transition-all active:scale-[0.98] active:bg-surface-light dark:active:bg-surface-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                @click="openEditModal(person)"
              >
                <!-- Avatar -->
                <div class="relative flex-shrink-0">
                  <InitialAvatar :name="person.name" :color="person.color" size="lg" />
                </div>

                <!-- Content -->
                <div class="flex-1 text-left min-w-0 flex flex-col justify-center">
                  <span
                    class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
                  >
                    {{ person.name }}
                  </span>
                </div>

                <!-- Chevron -->
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark group-active:bg-background-light dark:group-active:bg-background-dark transition-colors"
                >
                  <UIcon
                    name="chevron_right"
                    size="sm"
                    class="text-text-tertiary-light dark:text-text-tertiary-dark"
                  />
                </div>
              </button>
            </SwipeableItem>
          </div>
        </TransitionGroup>

        <!-- Empty state -->
        <div
          v-else
          data-testid="people-empty-state"
          class="h-[60vh] flex items-center justify-center mt-8"
        >
          <EmptyState
            icon="group"
            title="Нет контактов"
            description="Добавьте людей для быстрого выбора при создании долгов и разделении расходов"
            icon-bg-class="bg-primary/10 text-primary"
            :action="{ label: 'Создать контакт', onClick: openAddModal }"
          />
        </div>
      </template>
    </main>

    <!-- FAB for quick add -->
    <div class="fixed right-6 bottom-24 z-30 transition-transform hover:scale-105 active:scale-95">
      <button
        data-testid="add-person-fab"
        class="h-14 w-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        aria-label="Добавить новый контакт"
        @click="openAddModal"
      >
        <UIcon name="add" size="md" />
      </button>
    </div>

    <!-- Add/Edit Modal -->
    <UModal v-model="showModal" :title="editingPerson ? 'Редактировать' : 'Новый контакт'">
      <div class="space-y-6 pt-2 pb-1">
        <!-- Live Avatar Preview -->
        <div
          class="flex flex-col items-center justify-center gap-3 bg-surface-light dark:bg-surface-dark py-6 rounded-2xl border border-border-light/50 dark:border-border-dark/50"
        >
          <InitialAvatar
            :name="formName || '?'"
            :color="formColor"
            size="lg"
            class="shadow-md transition-all duration-300 transform scale-[1.3] my-2"
          />
          <span class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Предпросмотр
          </span>
        </div>

        <UInput
          v-model="formName"
          label="Имя или никнейм"
          placeholder="Например: Аня, Коля..."
          autofocus
          @keydown="(e: KeyboardEvent) => e.key === 'Enter' && handleSave()"
        />

        <UColorPicker v-model="formColor" :colors="ENTITY_COLORS" label="Цвет аватара" />
      </div>

      <template #actions>
        <!-- Modal Actions aligned -->
        <UButton variant="secondary" size="lg" class="flex-1" @click="showModal = false">
          Отмена
        </UButton>
        <UButton
          data-testid="save-person-btn"
          variant="primary"
          size="lg"
          class="flex-1"
          :loading="isSaving"
          :disabled="!formName.trim()"
          @click="handleSave"
        >
          {{ editingPerson ? 'Сохранить' : 'Добавить' }}
        </UButton>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <ConfirmDeleteModal
      :model-value="!!personToDelete"
      title="Удалить контакт?"
      :warning-text="`Контакт «${personToDelete?.name}» будет удалён. Это действие нельзя отменить.`"
      @update:model-value="!$event && (personToDelete = null)"
      @confirm="handleDelete"
      @cancel="personToDelete = null"
    />
  </div>
</template>
