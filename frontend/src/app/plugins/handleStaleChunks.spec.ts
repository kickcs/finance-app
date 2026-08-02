import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./reloadDocument', () => ({ reloadDocument: vi.fn() }));

type SwMock = {
  unregister: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

/** Ставит заглушки Service Worker API и Cache Storage, которых в jsdom нет. */
function stubServiceWorker(registration: SwMock | null, cacheKeys: string[] = []) {
  const cachesDelete = vi.fn().mockResolvedValue(true);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(registration) },
  });
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { keys: vi.fn().mockResolvedValue(cacheKeys), delete: cachesDelete },
  });
  return { cachesDelete };
}

function removeServiceWorker() {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(globalThis, 'caches');
}

/** Свежий модуль на каждый тест: защита от цикла живёт в состоянии модуля. */
async function armHandler() {
  vi.resetModules();
  const { handleStaleChunks } = await import('./handleStaleChunks');
  const { reloadDocument } = await import('./reloadDocument');
  handleStaleChunks();
  return { reload: vi.mocked(reloadDocument) };
}

const firePreloadError = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

/** `navigator.onLine` в jsdom — геттер на прототипе, поэтому подменяем свойством. */
function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

function restoreOnLine() {
  Reflect.deleteProperty(navigator, 'onLine');
}

function makeRegistration(): SwMock {
  return {
    unregister: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  removeServiceWorker();
  restoreOnLine();
});

describe('handleStaleChunks', () => {
  it('снимает устаревшего воркера и чистит кэши перед перезагрузкой', async () => {
    // Иначе перезагрузка получит из precache ту же оболочку с теми же
    // несуществующими чанками — и приложение застрянет на лоадере навсегда.
    const registration = makeRegistration();
    const { cachesDelete } = stubServiceWorker(registration, ['workbox-precache-v2', 'api-cache']);
    const { reload } = await armHandler();

    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(cachesDelete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(cachesDelete).toHaveBeenCalledWith('api-cache');
  });

  it('снимает воркера раньше, чем перезагружает', async () => {
    const registration = makeRegistration();
    stubServiceWorker(registration);
    const { reload } = await armHandler();

    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(registration.unregister.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    );
  });

  it('перезагружается и там, где Service Worker недоступен', async () => {
    removeServiceWorker();
    const { reload } = await armHandler();

    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('перезагружается, даже если снятие воркера упало', async () => {
    const registration: SwMock = {
      unregister: vi.fn().mockRejectedValue(new Error('нет доступа')),
      update: vi.fn().mockResolvedValue(undefined),
    };
    stubServiceWorker(registration);
    const { reload } = await armHandler();

    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('перезагружается, даже если снятие воркера повисло без ответа', async () => {
    // Ровно тот отказ, который лечим: висящий промис не должен превратить
    // спасательную перезагрузку в новое вечное ожидание.
    const registration: SwMock = {
      unregister: vi.fn().mockReturnValue(new Promise(() => {})),
      update: vi.fn().mockResolvedValue(undefined),
    };
    stubServiceWorker(registration);
    const { reload } = await armHandler();

    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 6000 });
  });

  it('офлайн не трогает кэши и не перезагружается', async () => {
    // Вне сети свежий HTML взять неоткуда, а снятие воркера вместе с кэшами
    // отняло бы у приложения единственную офлайн-копию: следующая загрузка
    // упёрлась бы в «нет соединения» — и уже безвозвратно, потому что чинить
    // нечем. Ошибка загрузки чанка офлайн — это не протухший деплой.
    const registration = makeRegistration();
    const { cachesDelete } = stubServiceWorker(registration, ['workbox-precache-v2']);
    setOnLine(false);
    const { reload } = await armHandler();

    firePreloadError();
    await new Promise((r) => setTimeout(r, 20));

    expect(reload).not.toHaveBeenCalled();
    expect(registration.unregister).not.toHaveBeenCalled();
    expect(cachesDelete).not.toHaveBeenCalled();
  });

  it('офлайн даёт ошибке всплыть, а не гасит её', async () => {
    // `preventDefault` заставил бы Vite проглотить ошибку импорта. Без спасательной
    // перезагрузки это означало бы навигацию, которая молча никуда не ведёт.
    stubServiceWorker(makeRegistration());
    setOnLine(false);
    await armHandler();

    expect(firePreloadError().defaultPrevented).toBe(false);
  });

  it('вернувшись в сеть, снова спасает как раньше', async () => {
    // Офлайн-выход не должен «залипать»: следующая ошибка уже в сети лечится
    // обычным путём.
    stubServiceWorker(makeRegistration());
    setOnLine(false);
    const { reload } = await armHandler();

    firePreloadError();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).not.toHaveBeenCalled();

    setOnLine(true);
    firePreloadError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('не перезагружается повторно внутри окна защиты от цикла', async () => {
    stubServiceWorker(makeRegistration());
    const { reload } = await armHandler();

    firePreloadError();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    firePreloadError();
    await new Promise((r) => setTimeout(r, 20));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
