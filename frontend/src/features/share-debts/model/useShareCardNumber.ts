import { computed, ref, type MaybeRefOrGetter } from 'vue';
import { useProfile } from '@/shared/api';
import { isValidCardNumber, normalizeCardNumber } from '@/shared/lib/format/cardNumber';

/**
 * Карта для перевода в шторке шаринга.
 *
 * Номер живёт в профиле, а не в снимке: его задают один раз и дальше он
 * подставляется сам. Менять его здесь же тоже надо — карту перевыпускают, и
 * гонять человека в настройки посреди отправки долга незачем. Поэтому правка
 * из шторки уходит в профиль: следующий снимок возьмёт уже новый номер.
 *
 * Приложить карту к конкретному снимку — отдельное решение: ссылку открывает
 * любой, у кого она есть, и «вы должны» с чужой картой внутри выглядит
 * требованием, которого владелец не делал.
 */
export function useShareCardNumber(userId: MaybeRefOrGetter<string | null>) {
  const { profile, updateProfile } = useProfile(userId);

  const savedCard = computed(() => profile.value?.payment_card_number ?? null);

  const isAttached = ref(true);
  const isEditing = ref(false);
  const draft = ref('');
  const isSaving = ref(false);
  const saveError = ref<string | null>(null);

  /** Номер, который уйдёт в снимок: либо приложенная карта, либо ничего. */
  const attachedCard = computed(() => (isAttached.value ? savedCard.value : null));

  const isDraftValid = computed(() => isValidCardNumber(draft.value));

  function startEdit(): void {
    draft.value = savedCard.value ?? '';
    saveError.value = null;
    isEditing.value = true;
  }

  function cancelEdit(): void {
    isEditing.value = false;
    draft.value = '';
    saveError.value = null;
  }

  /** Каждое открытие шторки начинается с чистого листа: карта приложена, правка закрыта. */
  function reset(): void {
    isAttached.value = true;
    cancelEdit();
  }

  async function saveCard(): Promise<void> {
    if (!isDraftValid.value || isSaving.value) return;

    isSaving.value = true;
    saveError.value = null;
    try {
      await updateProfile({ payment_card_number: normalizeCardNumber(draft.value) });
      isAttached.value = true;
      isEditing.value = false;
      draft.value = '';
    } catch {
      saveError.value = 'Не удалось сохранить карту';
    } finally {
      isSaving.value = false;
    }
  }

  return {
    savedCard,
    attachedCard,
    isAttached,
    isEditing,
    draft,
    isDraftValid,
    isSaving,
    saveError,
    startEdit,
    cancelEdit,
    saveCard,
    reset,
  };
}
