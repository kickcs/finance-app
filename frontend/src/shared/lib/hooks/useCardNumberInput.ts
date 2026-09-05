import { nextTick, ref, watch, type Ref } from 'vue';
import { formatCardNumber, normalizeCardNumber } from '@/shared/lib/format/cardNumber';

/**
 * Поле номера карты: в модели — голые цифры, на экране — группы по четыре.
 *
 * Простой `computed` с форматированием в `get` рассинхронизируется с полем:
 * если введённый символ нормализация выбрасывает (буква, двадцатая цифра),
 * модель не меняется, значение в шаблоне остаётся прежним — и Vue не переписывает
 * DOM, оставляя мусор в поле. Поэтому набранное сначала показываем как есть, а
 * нормализованным заменяем на следующем тике: это второй проход рендера, и он до
 * поля доходит.
 */
export function useCardNumberInput(model: Ref<string>) {
  const view = ref(formatCardNumber(model.value));

  // Значение пришло снаружи (открыли форму, подставили сохранённую карту).
  // Свой же ввод сюда не попадает: там цифры вида и модели совпадают.
  watch(model, (value) => {
    if (normalizeCardNumber(view.value) !== value) view.value = formatCardNumber(value);
  });

  async function onInput(value: string | number): Promise<void> {
    view.value = String(value);
    model.value = normalizeCardNumber(String(value));
    await nextTick();
    view.value = formatCardNumber(model.value);
  }

  return { view, onInput };
}
