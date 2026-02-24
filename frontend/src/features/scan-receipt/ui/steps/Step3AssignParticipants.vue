<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon, UModal, UInput } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics';
import type { ReceiptItem, Participant } from '../../model/types';
import ParticipantChip from '../ParticipantChip.vue';
import AssignableItemRow from '../AssignableItemRow.vue';

const props = defineProps<{
  items: ReceiptItem[];
  participants: Participant[];
  currency: string;
  hasMe: boolean;
  unassignedCount: number;
  serviceChargePercent: number | null;
}>();

const emit = defineEmits<{
  addParticipant: [name: string, isMe: boolean];
  removeParticipant: [id: string];
  toggleItemParticipant: [itemId: string, participantId: string];
  next: [];
  back: [];
}>();

// Active filter state
const activeFilter = ref<string | null>(null);

function toggleFilter(participantId: string) {
  activeFilter.value = activeFilter.value === participantId ? null : participantId;
}

// Filtered items based on active participant filter
const filteredItems = computed(() => {
  if (!activeFilter.value) return props.items;
  return props.items.filter((item) =>
    item.assignedParticipantIds.includes(activeFilter.value!)
  );
});

// Hint state
const showHint = ref(true);

function dismissHint() {
  showHint.value = false;
}

// Add participant modal
const addParticipantOpen = ref(false);
const newName = ref('');
const nameError = ref('');

function openAddParticipantSheet() {
  newName.value = '';
  nameError.value = '';
  addParticipantOpen.value = true;
}

function addMe() {
  haptics.tap();
  emit('addParticipant', 'Я', true);
  addParticipantOpen.value = false;
}

function confirmAdd() {
  const trimmed = newName.value.trim();
  if (!trimmed) {
    nameError.value = 'Введите имя участника';
    return;
  }
  haptics.tap();
  emit('addParticipant', trimmed, false);
  newName.value = '';
  nameError.value = '';
  addParticipantOpen.value = false;
}

function handleNext() {
  haptics.tap();
  emit('next');
}

function handleBack() {
  haptics.tap();
  emit('back');
}

function handleToggleItemParticipant(itemId: string, participantId: string) {
  haptics.tap();
  emit('toggleItemParticipant', itemId, participantId);
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- Participants bar — fixed height, horizontal scroll -->
    <div class="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border-light dark:border-border-dark">
      <!-- Section label -->
      <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
        Участники
      </p>

      <!-- Horizontal scrollable chips row -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <!-- Add participant button — always first -->
        <button
          type="button"
          aria-label="Добавить участника"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all duration-150 text-sm font-medium whitespace-nowrap"
          @click="openAddParticipantSheet"
        >
          <UIcon name="person_add" size="xs" />
          Добавить
        </button>

        <!-- Participant chips — one per person -->
        <TransitionGroup tag="div" name="chip-list" class="flex gap-2">
          <ParticipantChip
            v-for="p in participants"
            :key="p.id"
            :participant="p"
            :is-active="activeFilter === p.id"
            @click="toggleFilter(p.id)"
          />
        </TransitionGroup>
      </div>
    </div>

    <!-- Empty state — no participants -->
    <div
      v-if="participants.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-8 gap-5 py-10"
    >
      <div class="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center">
        <UIcon name="group_add" size="xl" class="text-primary" />
      </div>

      <div class="text-center">
        <h3 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
          Добавьте участников
        </h3>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Укажите, кто участвовал в покупке. Начните с себя.
        </p>
      </div>

      <!-- Quick-add "Я" -->
      <button
        type="button"
        class="flex items-center gap-3 w-full max-w-xs px-5 py-4 rounded-2xl bg-primary text-white shadow-md active:scale-[0.97] transition-all"
        @click="addMe"
      >
        <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <UIcon name="person" size="md" class="text-white" />
        </div>
        <div class="text-left">
          <p class="text-base font-semibold">Добавить «Я»</p>
          <p class="text-sm text-white/70">Я участвовал в покупке</p>
        </div>
        <UIcon name="add" size="sm" class="ml-auto text-white/80" />
      </button>

      <button
        type="button"
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark underline underline-offset-2"
        @click="openAddParticipantSheet"
      >
        Добавить другого участника
      </button>
    </div>

    <!-- Items list — scrollable, fills remaining height -->
    <div v-else class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4">

      <!-- Assignment instruction hint — shown only on first use -->
      <div
        v-if="showHint"
        class="flex items-start gap-3 p-3 mb-4 rounded-xl bg-info-light border border-primary/20"
      >
        <UIcon name="touch_app" size="sm" class="text-primary flex-shrink-0 mt-0.5" />
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark flex-1">
          Нажмите на позицию, чтобы назначить участников. Один товар может принадлежать
          нескольким людям.
        </p>
        <button
          type="button"
          aria-label="Закрыть подсказку"
          class="text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light active:scale-90 transition-all"
          @click="dismissHint"
        >
          <UIcon name="close" size="xs" />
        </button>
      </div>

      <!-- Items list -->
      <div class="space-y-2">
        <AssignableItemRow
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          :participants="participants"
          :currency="currency"
          :service-charge-percent="serviceChargePercent"
          @toggle-participant="handleToggleItemParticipant(item.id, $event)"
        />
      </div>

      <!-- Empty filtered state -->
      <div
        v-if="filteredItems.length === 0 && activeFilter"
        class="text-center py-8 text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        Нет позиций, назначенных этому участнику
      </div>
    </div>

    <!-- Footer — summary + continue -->
    <div class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark">

      <!-- Unassigned items warning -->
      <Transition name="section-slide">
        <div
          v-if="unassignedCount > 0"
          class="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-warning-light"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
          <p class="text-sm text-warning font-medium">
            {{ unassignedCount }} поз. без участника — назначьте «Я» или другого
          </p>
        </div>
      </Transition>

      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="participants.length === 0"
        aria-label="Перейти к итогу и созданию транзакций"
        @click="handleNext"
      >
        Далее — Итог
        <UIcon name="arrow_forward" size="sm" class="ml-2" />
      </UButton>
    </div>

  </div>

  <!-- Add participant modal -->
  <UModal v-model="addParticipantOpen" title="Добавить участника">
    <!-- "Я" quick-add — only shown if "Я" not already in list -->
    <button
      v-if="!hasMe"
      type="button"
      class="flex items-center gap-3 w-full px-4 py-3 rounded-xl mb-3 bg-primary-light border border-primary/20 active:scale-[0.98] transition-all"
      @click="addMe"
    >
      <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
        <UIcon name="person" size="sm" class="text-white" />
      </div>
      <div class="text-left">
        <p class="text-sm font-semibold text-primary">Добавить «Я»</p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Вы участвуете в этом чеке
        </p>
      </div>
      <UIcon name="add_circle" size="sm" class="text-primary ml-auto" />
    </button>

    <!-- Custom name input -->
    <div class="space-y-3">
      <UInput
        v-model="newName"
        label="Имя участника"
        placeholder="Например: Аня, Коля..."
        :error="nameError"
        @keydown.enter.prevent="confirmAdd"
      />
    </div>

    <template #actions>
      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="!newName.trim()"
        @click="confirmAdd"
      >
        Добавить
      </UButton>
    </template>
  </UModal>
</template>

<style scoped>
.chip-list-enter-active,
.chip-list-leave-active {
  transition: all 0.2s ease;
}
.chip-list-enter-from,
.chip-list-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.section-slide-enter-active,
.section-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.section-slide-enter-from,
.section-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
