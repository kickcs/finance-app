import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { watchDebounced } from '@vueuse/core';
import { debtQueryKeys, debtsApi, type CloseAllPreview } from '@/entities/debt';
import { HttpError } from '@/shared/api/http';
import type { Debt } from '@/shared/api/database.types';
import { buildCloseAllPreviewInput, type CloseAllPreviewOptions } from './closeAllInput';

/** Пауза набора суммы, после которой уходит новый предпросмотр. */
const PREVIEW_DEBOUNCE_MS = 300;

/** Отказ по правилам (закрыт, разные валюты) повтором не лечится, сбой сети или 5xx — может. */
function isClientError(error: unknown): boolean {
  return error instanceof HttpError && error.status >= 400 && error.status < 500;
}

/**
 * Предпросмотр «Закрыть все» с сервера для шторки.
 *
 * Первый запрос — «оплатить всё» (без суммы): его ответ — стартовый итог формы
 * (`baseline`). Дальше запросы идут с суммой и прощением из формы, но не на
 * каждую правку, а после паузы. Пока ответ на новый ввод в пути, остаётся
 * прошлый — строки не прыгают в скелет.
 */
export function useCloseAllPreview(options: {
  debts: MaybeRefOrGetter<Debt[]>;
  /** Шторка открыта: закрытая запросов не шлёт. */
  open: MaybeRefOrGetter<boolean>;
  amount: Ref<number>;
  forgiveRemainder: Ref<boolean>;
  /**
   * Ответ на «оплатить всё». Его владелец — шторка: форме нужен итог ещё до
   * того, как она (а с ней и этот хук) получит свои поля.
   */
  baseline: Ref<CloseAllPreview | null>;
}) {
  /**
   * Сумма идёт, только если ушла от «оплатить всё»: так стартовый запрос и «всё» делят
   * ключ, а исполнение шлёт ровно то же. Пока итога нет, форма ещё держит прошлое
   * открытие — её не читаем.
   */
  const paymentOptions = computed(() => {
    const baseline = options.baseline.value;
    const forgive = baseline !== null && options.forgiveRemainder.value;
    const isPayAll = baseline === null || (!forgive && options.amount.value === baseline.net);
    const result: CloseAllPreviewOptions = {
      forgiveRemainder: forgive,
    };
    if (!isPayAll) result.paymentAmount = options.amount.value;
    return result;
  });
  const wantedInput = computed(() =>
    buildCloseAllPreviewInput(toValue(options.debts), paymentOptions.value),
  );

  const input = ref(wantedInput.value);
  function flushInput() {
    input.value = wantedInput.value;
  }
  // Закрытая шторка запросов не шлёт; на открытии `rebaseline` и так сбрасывает ввод без паузы.
  watchDebounced(
    wantedInput,
    () => {
      if (toValue(options.open)) flushInput();
    },
    { debounce: PREVIEW_DEBOUNCE_MS },
  );

  // Каждое открытие — новый ключ: ответ прошлого открытия не станет стартовым итогом.
  const openId = ref(0);
  function rebaseline() {
    options.baseline.value = null;
    openId.value++;
    // Без паузы: стартовый запрос не должен ждать и не должен нести прошлый ввод.
    flushInput();
  }

  watch(
    () => toValue(options.open),
    (isOpen) => {
      if (isOpen) rebaseline();
    },
    { immediate: true },
  );

  const enabled = computed(() => toValue(options.open) && toValue(options.debts).length > 0);

  // Остатки изменились под открытой шторкой (список перезапросился после отказа) —
  // стартовый итог устарел, форма пересчитывается заново.
  const debtsFingerprint = computed(() =>
    toValue(options.debts)
      .map((d) => `${d.id}:${d.remaining_amount}`)
      .join('|'),
  );
  watch(debtsFingerprint, () => {
    if (enabled.value) rebaseline();
  });

  const query = useQuery({
    queryKey: computed(() => debtQueryKeys.closeAllPreview(openId.value, input.value)),
    queryFn: ({ queryKey }) => debtsApi.previewCloseAll(queryKey[2]),
    enabled,
    // Прошлый ответ держим только внутри одного открытия: ответ другого мог быть по другому человеку.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === openId.value ? previous : undefined,
    // Одна повторная попытка на сбой сети; дальше — кнопка «Повторить» в шторке.
    retry: (failureCount, error) => failureCount < 1 && !isClientError(error),
    // Расчёт нужен, пока шторка открыта; кэшировать его между открытиями незачем.
    gcTime: 0,
  });

  watch(
    () => query.data.value,
    (data) => {
      if (!data || query.isPlaceholderData.value || options.baseline.value) return;
      options.baseline.value = data;
    },
  );

  /** Ответ пришёл на тот ввод, что сейчас в форме: ни паузы набора, ни запроса в пути. */
  const isSettled = computed(
    () =>
      !!query.data.value &&
      !query.isPlaceholderData.value &&
      JSON.stringify(wantedInput.value) === JSON.stringify(input.value),
  );

  return {
    preview: query.data,
    error: query.error,
    /** Параметры платежа, которыми считан предпросмотр: исполнение берёт их же. */
    paymentOptions,
    retry: () => query.refetch(),
    /** «Повторить» нужно сбою сети или сервера; отказ по правилам повтором не лечится. */
    canRetry: computed(() => !!query.error.value && !isClientError(query.error.value)),
    isSettled,
    /** Первого ответа ещё не было: шторке рано показывать числа. */
    isLoading: computed(
      () => enabled.value && options.baseline.value === null && !query.error.value,
    ),
  };
}
