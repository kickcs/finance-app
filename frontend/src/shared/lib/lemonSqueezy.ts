/**
 * Ленивая загрузка LemonSqueezy SDK.
 *
 * Раньше `lemon.js` висел тегом <script defer> в index.html и грузился на каждой
 * загрузке приложения: 301-редирект на assets.lemonsqueezy.com плюс DNS/TLS к двум
 * чужим origin'ам — ради оверлея оплаты, который видит доля пользователей.
 *
 * SDK запрашивается, когда открывается экран апгрейда, — к клику по тарифу он
 * обычно уже готов. Вызывающий код никогда его не ждёт: если скрипт не поднялся,
 * оплата открывается через `window.open`.
 */
const SDK_URL = 'https://app.lemonsqueezy.com/js/lemon.js';

/** Заблокированный или зависший скрипт не отдаёт ни `load`, ни `error`. */
const LOAD_TIMEOUT_MS = 10_000;

let pending: Promise<void> | null = null;

function injectSdk(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;

    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      reject(new Error(reason));
    };

    const timer = window.setTimeout(() => fail('LemonSqueezy SDK load timed out'), LOAD_TIMEOUT_MS);

    script.src = SDK_URL;
    script.defer = true;
    script.addEventListener('load', () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // lemon.js создаёт window.LemonSqueezy только по событию `load` окна
      // (`window.addEventListener('load', createLemonSqueezy)` в конце файла).
      // Мы подключаем скрипт уже после этого события, поэтому инициализируем
      // вручную — иначе window.LemonSqueezy навсегда остаётся undefined и
      // оплата всегда уходит в window.open, который блокируют попап-блокировщики.
      window.createLemonSqueezy?.();
      resolve();
    });
    script.addEventListener('error', () => fail('LemonSqueezy SDK failed to load'));

    document.head.appendChild(script);
  });
}

export function loadLemonSqueezy(): Promise<void> {
  if (window.LemonSqueezy) return Promise.resolve();

  if (!pending) {
    const attempt = injectSdk();
    pending = attempt;
    // Дать следующему вызову шанс попробовать снова (сеть могла моргнуть).
    // Сбрасываем только свою попытку: к моменту запоздавшей ошибки в `pending`
    // уже может лежать более свежая — затирать её нельзя, иначе следующий
    // вызов подключит второй тег скрипта.
    attempt.catch(() => {
      if (pending === attempt) pending = null;
    });
  }

  return pending;
}
