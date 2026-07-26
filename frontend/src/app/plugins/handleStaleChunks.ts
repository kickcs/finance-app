const RELOAD_STAMP_KEY = 'ouro:chunk-reload-at';

/** Окно, внутри которого повторная ошибка считается признаком цикла, а не нового деплоя. */
const RELOAD_COOLDOWN_MS = 15_000;

/**
 * После деплоя старый index.html в кэше браузера ссылается на чанки с прежними
 * хешами, которых на сервере уже нет. Vite сообщает об этом событием
 * `vite:preloadError`; единственное разумное лечение — перезагрузить страницу,
 * чтобы получить свежий HTML со свежими URL.
 *
 * Отметка времени в sessionStorage защищает от цикла: если чанк не подтянулся и
 * сразу после перезагрузки, даём ошибке всплыть, а не крутим reload бесконечно.
 *
 * Доступ к sessionStorage может бросить SecurityError там, где хранилище
 * запрещено (приватный режим Safari, iframe Telegram Mini App на web.telegram.org).
 * Тогда защита от цикла деградирует до переменной в памяти — она переживает
 * навигацию внутри страницы, но не перезагрузку, поэтому дополнительно
 * ограничиваем число перезагрузок на жизнь документа.
 */
let reloadsThisDocument = 0;

const readStamp = (): number => {
  try {
    return Number(sessionStorage.getItem(RELOAD_STAMP_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeStamp = (value: number): void => {
  try {
    sessionStorage.setItem(RELOAD_STAMP_KEY, String(value));
  } catch {
    // хранилище недоступно — полагаемся на reloadsThisDocument
  }
};

export function handleStaleChunks(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadsThisDocument > 0) return;
    if (Date.now() - readStamp() < RELOAD_COOLDOWN_MS) return;

    reloadsThisDocument += 1;
    writeStamp(Date.now());
    event.preventDefault();
    window.location.reload();
  });
}
