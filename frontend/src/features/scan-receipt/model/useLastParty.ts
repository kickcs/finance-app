import { useLocalStorage, StorageSerializers } from '@vueuse/core';
import type { Participant } from './types';

export interface LastPartyMember {
  name: string;
  isMe: boolean;
  /** Имя плательщика (id между сессиями не живут) */
  paidByName: string | null;
}

export interface LastParty {
  members: LastPartyMember[];
  savedAt: number;
}

const STORAGE_KEY = 'scan-receipt:last-party';

/** Состав участников последнего успешно сохранённого чека — для «Как в прошлый раз» */
export function useLastParty() {
  const lastParty = useLocalStorage<LastParty | null>(STORAGE_KEY, null, {
    serializer: StorageSerializers.object,
  });

  function saveParty(participants: Participant[]) {
    if (participants.length === 0) return;
    const byId = new Map(participants.map((p) => [p.id, p]));
    lastParty.value = {
      members: participants.map((p) => ({
        name: p.name,
        isMe: p.isMe,
        paidByName: p.paidById ? (byId.get(p.paidById)?.name ?? null) : null,
      })),
      savedAt: Date.now(),
    };
  }

  return { lastParty, saveParty };
}
