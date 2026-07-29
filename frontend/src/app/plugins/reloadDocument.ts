/**
 * Обёртка над перезагрузкой документа.
 *
 * Существует отдельным модулем ради тестируемости: `window.location` в jsdom не
 * подменяется, а вот модуль — подменяется.
 */
export function reloadDocument(): void {
  window.location.reload();
}
