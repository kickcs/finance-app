import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useEventListener } from '@vueuse/core';
import { formatNumberWithSpaces, sanitizeCurrencyInput } from '@/shared/lib/format/currency';

/**
 * Поле ввода суммы: скрытый `input` под нарисованной строкой.
 *
 * Такое поле на экране два: главная сумма (`AmountHeadline`) и сумма в ряду с
 * другими полями (`HeroAmount` — вторая сумма перевода, подтверждение импорта).
 * Отличаются они только оформлением, поэтому поведение — санитайз ввода,
 * форматирование разрядов, синхронизация с внешним значением и автофокус —
 * живёт здесь, в одном месте.
 */
export function useAmountInput(options: {
  amount: MaybeRefOrGetter<number>;
  autofocus?: MaybeRefOrGetter<boolean | undefined>;
  onChange: (value: number) => void;
}) {
  const inputRef = ref<HTMLInputElement | null>(null);
  const isFocused = ref(false);
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

  function onInput(event: Event) {
    const sanitized = sanitizeCurrencyInput((event.target as HTMLInputElement).value);
    rawValue.value = sanitized;
    options.onChange(parseFloat(sanitized) || 0);
  }

  /**
   * Фокус ждёт разрешения снаружи, а не ставится на монтировании: раньше
   * клавиатура открывалась посреди перехода между страницами, `h-dvh`
   * пересчитывался, и вход на экран дёргался. Страница включает автофокус
   * после конца слайда.
   *
   * Фокусим один раз: повторное включение флага — это уже возврат на страницу,
   * а не первый заход, и выдёргивать фокус из другого поля незачем.
   */
  const hasFocused = ref(false);
  watch(
    () => toValue(options.autofocus),
    (enabled) => {
      if (!enabled || hasFocused.value) return;
      // Защёлку ставим по факту фокуса, а не до него: если к этому тику поля ещё
      // нет, попытка должна остаться неиспользованной — иначе автофокус
      // потерялся бы навсегда.
      nextTick(() => {
        const el = inputRef.value;
        if (!el) return;
        hasFocused.value = true;
        el.focus();
      });
    },
    { immediate: true },
  );

  return { inputRef, rawValue, displayAmount, isFocused, onInput };
}
