import { ref, computed, type Ref } from 'vue';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { useHaptics } from '@/shared/lib/haptics';
import { ALL_PARTICIPANTS_ID } from './constants';
import type { ReceiptItem, Participant } from './types';

let nextPuid = 0;
function puid(): string {
  return `rp_${++nextPuid}_${Date.now()}`;
}

export function useParticipantsStep(items: Ref<ReceiptItem[]>) {
  const { trigger } = useHaptics();

  const participants = ref<Participant[]>([]);

  function addParticipant(name: string, isMe = false, paidById: string | null = null) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: puid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex] as string,
      paidById,
    });
    trigger('selection');
  }

  function removeParticipant(id: string) {
    participants.value = participants.value.filter((p) => p.id !== id);
    // Clear paidById references to the removed participant
    participants.value.forEach((p) => {
      if (p.paidById === id) p.paidById = null;
    });
    // Remove from all item assignments
    items.value.forEach((item) => {
      item.assignedParticipantIds = item.assignedParticipantIds.filter((pid) => pid !== id);
    });
    trigger('warning');
  }

  function toggleItemParticipant(itemId: string, participantId: string) {
    const item = items.value.find((i) => i.id === itemId);
    if (!item) return;

    if (participantId === ALL_PARTICIPANTS_ID) {
      const allIds = participants.value.map((p) => p.id);
      const isAssignedToAll = allIds.every((id) => item.assignedParticipantIds.includes(id));
      if (isAssignedToAll) {
        item.assignedParticipantIds = [];
      } else {
        item.assignedParticipantIds = [...allIds];
      }
    } else {
      const idx = item.assignedParticipantIds.indexOf(participantId);
      if (idx === -1) {
        item.assignedParticipantIds.push(participantId);
      } else {
        item.assignedParticipantIds.splice(idx, 1);
      }
    }
    trigger('selection');
  }

  const hasMe = computed(() => participants.value.some((p) => p.isMe));

  const unassignedCount = computed(
    () => items.value.filter((item) => item.assignedParticipantIds.length === 0).length,
  );

  return {
    participants,
    hasMe,
    unassignedCount,
    addParticipant,
    removeParticipant,
    toggleItemParticipant,
  };
}
