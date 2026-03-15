<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { UButton, UIcon, UProgressBar } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import type { ReceiptItem, ReceiptCharge, Participant } from '../../model/types';
import AssignableItemRow from '../AssignableItemRow.vue';
import AddParticipantModal from '../AddParticipantModal.vue';
import ParticipantsBar from '../ParticipantsBar.vue';

const props = defineProps<{
  items: ReceiptItem[];
  participants: Participant[];
  currency: string;
  hasMe: boolean;
  unassignedCount: number;
  charges: ReceiptCharge[];
}>();
const emit = defineEmits<{
  addParticipant: [name: string, isMe: boolean, paidById: string | null];
  removeParticipant: [id: string];
  toggleItemParticipant: [itemId: string, participantId: string];
  assignAll: [participantId: string];
  next: [];
  back: [];
}>();
const { trigger } = useHaptics();

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
);

function setActiveParticipant(participantId: string) {
  activeParticipantId.value = participantId;
  trigger('selection');
}

// Assignment progress
const assignedCount = computed(
  () => props.items.filter((item) => item.assignedParticipantIds.length > 0).length,
);

const assignProgress = computed(() =>
  props.items.length > 0 ? Math.round((assignedCount.value / props.items.length) * 100) : 0,
);

// --- Add participant modal ---
const addParticipantOpen = ref(false);

function openAddParticipantSheet() {
  addParticipantOpen.value = true;
}

function addMe() {
  trigger('selection');
  emit('addParticipant', 'Я', true, null);
}

function handleRemoveParticipant(id: string) {
  emit('removeParticipant', id);
  if (activeParticipantId.value === id) {
    activeParticipantId.value = props.participants.find((p) => p.id !== id)?.id ?? null;
  }
}

// Assign all items to a participant (single batch operation)
function assignAllTo(participantId: string) {
  emit('assignAll', participantId);
}

function handleNext() {
  trigger('selection');
  emit('next');
}

function handleTapRow(item: ReceiptItem) {
  if (!activeParticipantId.value) {
    trigger('error');
    return;
  }
  trigger('success');
  emit('toggleItemParticipant', item.id, activeParticipantId.value);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Participants bar -->
    <ParticipantsBar
      :participants="participants"
      :active-participant-id="activeParticipantId"
      :unassigned-count="unassignedCount"
      @set-active="setActiveParticipant"
      @remove="handleRemoveParticipant"
      @assign-all="assignAllTo"
      @open-add="openAddParticipantSheet"
    />

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
        @click="
          addMe();
          nextTick(() => openAddParticipantSheet());
        "
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
          :charges="charges"
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

    <!-- Add participant modal -->
    <AddParticipantModal
      v-model:open="addParticipantOpen"
      :participants="participants"
      :has-me="hasMe"
      @add-participant="(name, isMe, paidById) => emit('addParticipant', name, isMe, paidById)"
      @remove-participant="handleRemoveParticipant"
    />
  </div>
</template>

<style>
@import '../transitions.css';
</style>
