import { reloadDocument } from './reloadDocument';

const RELOAD_STAMP_KEY = 'ouro:chunk-reload-at';

/** Окно, внутри которого повторная ошибка считается признаком цикла, а не нового деплоя. */
const RELOAD_COOLDOWN_MS = 15_000;

/**
 * Сколько ждём снятия воркера, прежде чем перезагрузиться без него.
 *
 * Спасательная операция не имеет права сама стать вечным ожиданием: зависший
 * промис в `unregister()` или `caches` оставил бы пользователя ровно на том
 * загрузочном экране, ради которого всё и затевалось. Перезагрузка без снятия
 * воркера может не помочь, но это по-прежнему лучше застывшего экрана.
 */
const RECOVERY_TIMEOUT_MS = 3_000;

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

/**
 * Снимает устаревшего Service Worker вместе с его кэшами.
 *
 * Без этого перезагрузка бесполезна. В precache лежит только оболочка —
 * `index.html` и входной чанк, — а чанки страниц тянутся из сети по хешам,
 * зашитым в этой самой закэшированной оболочке. Воркер переживает reload и
 * отдаёт ту же оболочку с теми же мёртвыми ссылками: страница перезагружается,
 * чанк снова получает 404, защита от цикла гасит вторую попытку — и приложение
 * навсегда остаётся на загрузочном экране.
 *
 * Мягко обновить воркера тут нечем: `registerType` — `prompt`, а предложение
 * обновиться показывается только на дашборде. Вход в мини-приложение идёт
 * `/tma` → инбокс импорта, дашборда не касается, так что ждущий воркер может
 * простоять сколько угодно. Снятие регистрации — единственный способ гарантированно
 * увести следующую загрузку в сеть; свежий воркер зарегистрируется на ней заново.
 */
async function dropStaleServiceWorker(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.unregister();

    const cacheStorage = globalThis.caches;
    const keys = (await cacheStorage?.keys()) ?? [];
    await Promise.all(keys.map((key) => cacheStorage.delete(key)));
  } catch {
    // Реестр воркеров или хранилище кэшей недоступны — перезагружаемся как есть:
    // шанс попасть на свежую оболочку всё равно выше, чем у зависшего экрана.
  }
}

export function handleStaleChunks(): void {
  window.addEventListener('vite:preloadError', (event) => {
    // Офлайн лечить нечем, а навредить можно. Свежий HTML взять неоткуда, зато
    // снятие воркера вместе с кэшами отнимет у приложения единственную
    // офлайн-копию: следующая загрузка упрётся в «нет соединения», и уже
    // безвозвратно — восстанавливать будет не из чего.
    //
    // Вне сети ошибка загрузки чанка означает не протухший деплой, а промах
    // мимо рантайм-кэша (запись вытеснена по `maxEntries`). Даём ошибке
    // всплыть: пользователь остаётся на текущей странице, кэш переживает
    // отключение, и с возвращением сети всё чинится само.
    if (navigator.onLine === false) return;

    if (reloadsThisDocument > 0) return;
    if (Date.now() - readStamp() < RELOAD_COOLDOWN_MS) return;

    reloadsThisDocument += 1;
    writeStamp(Date.now());
    event.preventDefault();
    void Promise.race([
      dropStaleServiceWorker(),
      new Promise<void>((resolve) => setTimeout(resolve, RECOVERY_TIMEOUT_MS)),
    ]).then(reloadDocument);
  });
}
