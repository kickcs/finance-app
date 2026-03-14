<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { ALL_PARTICIPANTS_ID, ALL_PARTICIPANTS_COLOR } from '../model/constants';
import type { Participant } from '../model/types';
import ParticipantChip from './ParticipantChip.vue';

defineProps<{
  participants: Participant[];
  activeParticipantId: string | null;
  unassignedCount: number;
}>();
const emit = defineEmits<{
  setActive: [id: string];
  remove: [id: string];
  assignAll: [id: string];
  openAdd: [];
}>();

/** Virtual "All" participant chip */
const allParticipantChip = computed<Participant>(() => ({
  id: ALL_PARTICIPANTS_ID,
  name: 'На всех',
  color: ALL_PARTICIPANTS_COLOR,
  isMe: false,
  paidById: null,
}));
</script>

<template>
  <div class="flex-shrink-0 px-5 pt-3 pb-3 border-b border-border-light dark:border-border-dark">
    <!-- Horizontal scrollable chips row -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <!-- Add participant button -->
      <button
        type="button"
        aria-label="Добавить участника"
        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all duration-150 text-sm font-medium whitespace-nowrap"
        @click="emit('openAdd')"
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
          @click="emit('setActive', ALL_PARTICIPANTS_ID)"
        />

        <ParticipantChip
          v-for="p in participants"
          :key="p.id"
          :participant="p"
          :is-active="activeParticipantId === p.id"
          :paid-by-name="
            p.paidById ? participants.find((pp) => pp.id === p.paidById)?.name : undefined
          "
          @click="emit('setActive', p.id)"
        />
      </TransitionGroup>
    </div>

    <!-- Actions row: assign all + remove active -->
    <div class="flex items-center justify-between mt-2">
      <Transition name="section-slide">
        <button
          v-if="
            activeParticipantId &&
            unassignedCount > 0 &&
            activeParticipantId !== ALL_PARTICIPANTS_ID
          "
          type="button"
          class="flex items-center gap-1.5 text-xs text-primary font-medium active:opacity-70 transition-opacity"
          @click="emit('assignAll', activeParticipantId)"
        >
          <UIcon name="done_all" size="xs" />
          Назначить все пустые
        </button>
        <span v-else />
      </Transition>

      <Transition name="section-slide">
        <button
          v-if="activeParticipantId && activeParticipantId !== ALL_PARTICIPANTS_ID"
          type="button"
          class="flex items-center gap-1 text-xs text-danger font-medium active:opacity-70 transition-opacity"
          @click="emit('remove', activeParticipantId)"
        >
          <UIcon name="close" size="xs" />
          Убрать
        </button>
      </Transition>
    </div>
  </div>
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
</style>
