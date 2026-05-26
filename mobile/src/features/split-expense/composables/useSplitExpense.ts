import { useState, useCallback } from 'react';

export type SplitParticipant = { personId: string; share: number };

export function useSplitExpense(initial: SplitParticipant[] = []) {
  const [enabled, setEnabled] = useState(initial.length > 0);
  const [participants, setParticipants] = useState<SplitParticipant[]>(initial);

  const add = useCallback((personId: string) => {
    setParticipants((p) =>
      p.some((x) => x.personId === personId) ? p : [...p, { personId, share: 0 }],
    );
  }, []);

  const remove = useCallback((personId: string) => {
    setParticipants((p) => p.filter((x) => x.personId !== personId));
  }, []);

  const setShare = useCallback((personId: string, share: number) => {
    setParticipants((p) =>
      p.map((x) => (x.personId === personId ? { ...x, share } : x)),
    );
  }, []);

  const reset = useCallback(() => {
    setParticipants([]);
    setEnabled(false);
  }, []);

  const totalShared = participants.reduce((s, p) => s + p.share, 0);

  return { enabled, setEnabled, participants, add, remove, setShare, reset, totalShared };
}
