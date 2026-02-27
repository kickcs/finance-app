<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UButton, UIcon, UModal, UInput, UProgressBar } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';
import { haptics } from '@/shared/lib/haptics';
import type { ReceiptItem, Participant } from '../../model/types';
import { ALL_PARTICIPANTS_ID, ALL_PARTICIPANTS_COLOR } from '../../model/constants';
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

const activeParticipantId = ref<string | null>(
  props.participants.length > 0 ? props.participants[0].id : null,
);

watch(
  () => props.participants,
  (newVal) => {
    if (!activeParticipantId.value && newVal.length > 0) {
      activeParticipantId.value = newVal[0].id;
    }
  },
  { immediate: true },
);

/** Виртуальный участник «На всех» для списка чипов */
const allParticipantChip = computed<Participant>(() => ({
  id: ALL_PARTICIPANTS_ID,
  name: 'На всех',
  color: ALL_PARTICIPANTS_COLOR,
  isMe: false,
}));

function setActiveParticipant(participantId: string) {
  activeParticipantId.value = participantId;
  haptics.tap();
}

// Assignment progress
const assignedCount = computed(
  () => props.items.filter((item) => item.assignedParticipantIds.length > 0).length,
);

const assignProgress = computed(() =>
  props.items.length > 0 ? Math.round((assignedCount.value / props.items.length) * 100) : 0,
);

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

// Assign all items to a participant
function assignAllTo(participantId: string) {
  for (const item of props.items) {
    if (!item.assignedParticipantIds.includes(participantId)) {
      emit('toggleItemParticipant', item.id, participantId);
    }
  }
  haptics.tap();
}

function handleNext() {
  haptics.tap();
  emit('next');
}

function handleTapRow(item: ReceiptItem) {
  if (!activeParticipantId.value) {
    haptics.error();
    return;
  }
  haptics.success();
  emit('toggleItemParticipant', item.id, activeParticipantId.value);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Participants bar -->
    <div class="flex-shrink-0 px-5 pt-3 pb-3 border-b border-border-light dark:border-border-dark">
      <!-- Horizontal scrollable chips row -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <!-- Add participant button -->
        <button
          type="button"
          aria-label="Добавить участника"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all duration-150 text-sm font-medium whitespace-nowrap"
          @click="openAddParticipantSheet"
        >
          <UIcon name="add" size="xs" />
          Добавить
        </button>

        <!-- Participant chips -->
        <TransitionGroup tag="div" name="chip-list" class="flex gap-2">
          <ParticipantChip
            v-if="participants.length > 1"
            :key="ALL_PARTICIPANTS_ID"
            :participant="allParticipantChip"
            :is-active="activeParticipantId === ALL_PARTICIPANTS_ID"
            @click="setActiveParticipant(ALL_PARTICIPANTS_ID)"
          />

          <ParticipantChip
            v-for="p in participants"
            :key="p.id"
            :participant="p"
            :is-active="activeParticipantId === p.id"
            @click="setActiveParticipant(p.id)"
          />
        </TransitionGroup>
      </div>

      <Transition name="section-slide">
        <button
          v-if="
            activeParticipantId &&
            unassignedCount > 0 &&
            activeParticipantId !== ALL_PARTICIPANTS_ID
          "
          type="button"
          class="flex items-center gap-1.5 mt-2 text-xs text-primary font-medium active:opacity-70 transition-opacity"
          @click="assignAllTo(activeParticipantId)"
        >
          <UIcon name="done_all" size="xs" />
          Назначить все пустые позиции этому участнику
        </button>
      </Transition>
    </div>

    <!-- Empty state — no participants -->
    <div
      v-if="participants.length === 0"
      class="flex-1 flex flex-col items-center justify-center px-8 gap-4"
    >
      <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <UIcon name="group_add" size="xl" class="text-primary" />
      </div>

      <div class="text-center">
        <h3
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
        >
          Добавьте участников
        </h3>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Укажите, кто участвовал в покупке
        </p>
      </div>

      <!-- Quick-add "Я" -->
      <button
        v-if="!hasMe"
        type="button"
        class="flex items-center gap-3 w-full max-w-xs px-4 py-3.5 rounded-2xl bg-primary text-white shadow-md shadow-primary/20 active:scale-[0.97] transition-all"
        @click="addMe"
      >
        <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <UIcon name="person" size="sm" class="text-white" />
        </div>
        <div class="text-left flex-1">
          <p class="text-sm font-semibold">Добавить «Я»</p>
          <p class="text-xs text-white/60">Я участвую в покупке</p>
        </div>
        <UIcon name="add" size="sm" class="text-white/70" />
      </button>

      <button
        type="button"
        class="text-sm text-text-secondary-light dark:text-text-secondary-dark underline underline-offset-2"
        @click="openAddParticipantSheet"
      >
        Добавить другого участника
      </button>
    </div>

    <!-- Items list -->
    <div v-else class="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-4">
      <!-- Assignment progress bar -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Назначено {{ assignedCount }} из {{ items.length }}
          </span>
          <span
            class="text-xs font-medium tabular-nums"
            :class="
              assignProgress === 100
                ? 'text-success'
                : 'text-text-secondary-light dark:text-text-secondary-dark'
            "
          >
            {{ assignProgress }}%
          </span>
        </div>
        <UProgressBar
          :value="assignProgress"
          size="sm"
          :color="assignProgress === 100 ? 'success' : 'primary'"
        />
      </div>

      <!-- Items list -->
      <div class="space-y-2">
        <AssignableItemRow
          v-for="item in items"
          :key="item.id"
          :item="item"
          :participants="participants"
          :currency="currency"
          :service-charge-percent="serviceChargePercent"
          :active-brush-id="activeParticipantId"
          @tap-row="handleTapRow(item)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light dark:bg-background-dark"
    >
      <!-- Unassigned warning -->
      <Transition name="section-slide">
        <div
          v-if="unassignedCount > 0 && participants.length > 0"
          class="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20"
          role="alert"
        >
          <UIcon name="warning" size="sm" class="text-warning flex-shrink-0" />
          <p class="text-xs text-warning font-medium flex-1">
            {{ unassignedCount }}
            {{ pluralize(unassignedCount, 'позиция', 'позиции', 'позиций') }} без участника
          </p>
        </div>
      </Transition>

      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="participants.length === 0"
        @click="handleNext"
      >
        Далее — Итог
        <UIcon name="arrow_forward" size="sm" class="ml-2" />
      </UButton>
    </div>
  </div>

  <!-- Add participant modal -->
  <UModal v-model="addParticipantOpen" title="Добавить участника">
    <!-- "Я" quick-add -->
    <button
      v-if="!hasMe"
      type="button"
      class="flex items-center gap-3 w-full px-4 py-3 rounded-xl mb-3 bg-primary/[0.06] border border-primary/15 active:scale-[0.98] transition-all"
      @click="addMe"
    >
      <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
        <UIcon name="person" size="sm" class="text-white" />
      </div>
      <div class="text-left flex-1">
        <p class="text-sm font-semibold text-primary">Добавить «Я»</p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Вы участвуете в этом чеке
        </p>
      </div>
      <UIcon name="add_circle" size="sm" class="text-primary" />
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

<style>
@import '../transitions.css';
</style>

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
</style>
