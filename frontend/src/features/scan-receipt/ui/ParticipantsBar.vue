<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { ALL_PARTICIPANTS_ID, ALL_PARTICIPANTS_COLOR } from '../model/constants';
import type { Participant } from '../model/types';
import ParticipantChip from './ParticipantChip.vue';

const props = defineProps<{
  participants: Participant[];
  activeParticipantId: string | null;
}>();
const emit = defineEmits<{
  setActive: [id: string];
  openManage: [];
}>();

/** Virtual "All" participant chip */
const allParticipantChip = computed<Participant>(() => ({
  id: ALL_PARTICIPANTS_ID,
  name: 'На всех',
  color: ALL_PARTICIPANTS_COLOR,
  isMe: false,
  paidById: null,
}));

const manageLabel = computed(() => (props.participants.length > 0 ? 'Изменить' : 'Добавить'));
</script>

<template>
  <div class="flex-shrink-0 px-5 pt-3 pb-3 border-b border-border-light dark:border-border-dark">
    <!-- Horizontal scrollable chips row: кисть + вход в управление -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        type="button"
        :aria-label="manageLabel + ' участников'"
        class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary active:scale-95 transition-all duration-150 text-sm font-medium whitespace-nowrap"
        @click="emit('openManage')"
      >
        <UIcon :name="participants.length > 0 ? 'edit' : 'add'" size="xs" />
        {{ manageLabel }}
      </button>

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

    <!-- Подсказка режима кисти -->
    <p
      v-if="participants.length > 0"
      class="mt-1.5 text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      Выберите участника и отмечайте его позиции тапом
    </p>
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

@media (prefers-reduced-motion: reduce) {
  .chip-list-enter-active,
  .chip-list-leave-active {
    transition: opacity 0.15s ease !important;
  }
  .chip-list-enter-from,
  .chip-list-leave-to {
    transform: none !important;
  }
}
</style>
