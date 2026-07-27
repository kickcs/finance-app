import { computed, nextTick, onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useEventListener, useTimeoutFn } from '@vueuse/core';
import { formatNumberWithSpaces, sanitizeCurrencyInput } from '@/shared/lib/format/currency';

/** Сколько держится пружина на первой набранной цифре. */
const BOUNCE_MS = 160;

/**
 * Поле ввода суммы: скрытый `input` под нарисованной строкой.
 *
 * Такое поле на экране два: главная сумма на плите (`AmountSlab`) и сумма в
 * ряду с другими полями (`HeroAmount` — вторая сумма перевода, подтверждение
 * импорта). Отличаются они только оформлением, поэтому поведение — санитайз
 * ввода, форматирование разрядов, синхронизация с внешним значением, пружина
 * и автофокус — живёт здесь, в одном месте.
 */
export function useAmountInput(options: {
  amount: MaybeRefOrGetter<number>;
  autofocus?: MaybeRefOrGetter<boolean | undefined>;
  onChange: (value: number) => void;
}) {
  const inputRef = ref<HTMLInputElement | null>(null);
  const isFocused = ref(false);
  const isBouncing = ref(false);
  const rawValue = ref(toValue(options.amount) ? String(toValue(options.amount)) : '');

  useEventListener(inputRef, 'focus', () => (isFocused.value = true));
  useEventListener(inputRef, 'blur', () => (isFocused.value = false));

  /**
   * Числового сравнения достаточно, чтобы не переписывать набираемое: пока
   * печатают, внешнее значение — эхо нашего же вызова, и значения совпадают.
   * Отдельного бэйла по фокусу быть не должно, иначе установка суммы извне
   * (чип частой суммы) не доезжает до поля: в Safari тап по кнопке не снимает
   * фокус с input, и на экране остаётся старое число.
   */
  watch(
    () => toValue(options.amount),
    (newAmount) => {
      if ((parseFloat(rawValue.value) || 0) !== newAmount) {
        rawValue.value = newAmount ? String(newAmount) : '';
      }
    },
  );

  const displayAmount = computed(() => {
    if (!rawValue.value) return '0';
    const dotIndex = rawValue.value.indexOf('.');
    if (dotIndex === -1) return formatNumberWithSpaces(rawValue.value) || '0';
    const intPart = rawValue.value.slice(0, dotIndex);
    const decPart = rawValue.value.slice(dotIndex); // вместе с точкой
    return (formatNumberWithSpaces(intPart || '0') || '0') + decPart;
  });

  const { start: startBounce } = useTimeoutFn(() => (isBouncing.value = false), BOUNCE_MS, {
    immediate: false,
  });

  function onInput(event: Event) {
    const sanitized = sanitizeCurrencyInput((event.target as HTMLInputElement).value);
    rawValue.value = sanitized;
    const num = parseFloat(sanitized) || 0;
    if (!toValue(options.amount) && num > 0) {
      isBouncing.value = true;
      startBounce();
    }
    options.onChange(num);
  }

  onMounted(() => {
    if (toValue(options.autofocus)) {
      nextTick(() => inputRef.value?.focus());
    }
  });

  return { inputRef, rawValue, displayAmount, isFocused, isBouncing, onInput };
}
