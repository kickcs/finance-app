import { ref, computed, type Ref } from 'vue';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { useHaptics } from '@/shared/lib/haptics';
import { uid } from './uid';
import { ALL_PARTICIPANTS_ID } from './constants';
import type { ReceiptItem, Participant } from './types';

export function useParticipantsStep(items: Ref<ReceiptItem[]>) {
  const { trigger } = useHaptics();

  const participants = ref<Participant[]>([]);

  function addParticipant(name: string, isMe = false, paidById: string | null = null) {
    const colorIndex = participants.value.length % ENTITY_COLORS.length;
    participants.value.push({
      id: uid(),
      name,
      isMe,
      color: ENTITY_COLORS[colorIndex] as string,
      paidById,
    });
    trigger('selection');
  }

  /**
   * Назначает плательщика участнику. paidById=null — платит сам.
   * Плательщиком может быть только участник, который платит сам за себя
   * (без цепочек A→B→C); зависимые нового зависимого отвязываются.
   */
  function setPaidBy(id: string, paidById: string | null) {
    const participant = participants.value.find((p) => p.id === id);
    if (!participant || paidById === id) return;
    if (paidById) {
      const payer = participants.value.find((p) => p.id === paidById);
      if (!payer || payer.paidById) return;
      // Участник становится зависимым — те, за кого платил он, снова платят сами
      participants.value.forEach((p) => {
        if (p.paidById === id) p.paidById = null;
      });
    }
    participant.paidById = paidById;
    trigger('selection');
  }

  /** Все позиции — всем участникам поровну («просто делим счёт») */
  function assignAllToEveryone() {
    const allIds = participants.value.map((p) => p.id);
    if (allIds.length === 0) return;
    items.value.forEach((item) => {
      item.assignedParticipantIds = [...allIds];
    });
    trigger('success');
  }

  /** Неназначенные позиции — участнику «Я» */
  function assignRestToMe() {
    const me = participants.value.find((p) => p.isMe);
    if (!me) return;
    items.value.forEach((item) => {
      if (item.assignedParticipantIds.length === 0) {
        item.assignedParticipantIds.push(me.id);
      }
    });
    trigger('success');
  }

  /** Восстановление состава «как в прошлый раз»: имена → участники, платежи по позиции */
  function restoreParty(members: { name: string; isMe: boolean; paidByName: string | null }[]) {
    if (participants.value.length > 0 || members.length === 0) return;
    for (const member of members) {
      addParticipant(member.name, member.isMe, null);
    }
    // Плательщика ищем по ПОЗИЦИИ в members, а не по имени: участники создаются
    // строго в порядке members, поэтому participants.value[i] ↔ members[i].
    // Резолв по имени ломался бы при одинаковых именах (двое «Иван» → связь
    // паплайилась на первого, второй молча терял плательщика).
    members.forEach((member, i) => {
      if (!member.paidByName) return;
      const payerIndex = members.findIndex((m) => m.name === member.paidByName);
      if (payerIndex === -1 || payerIndex === i) return;
      const dependent = participants.value[i];
      const payer = participants.value[payerIndex];
      if (dependent && payer) {
        dependent.paidById = payer.id;
      }
    });
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
    setPaidBy,
    toggleItemParticipant,
    assignAllToEveryone,
    assignRestToMe,
    restoreParty,
  };
}
