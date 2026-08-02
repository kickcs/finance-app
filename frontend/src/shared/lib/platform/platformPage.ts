import { watch } from 'vue';
import type { Component } from 'vue';
import type { Router } from 'vue-router';
import { useIsDesktop } from './useIsDesktop';

export type PageLoader = () => Promise<Component | { default: Component }>;

/** Ленивый компонент маршрута в том виде, в каком его ждёт vue-router. */
type RouteComponentLoader = () => Promise<Component>;

/**
 * `defineAsyncComponent` сам разворачивает `{ default }` только у настоящих
 * ES-модулей (у них есть `Symbol.toStringTag === 'Module'`). У обычного
 * объекта-литерала с полем `default` этого тега нет, поэтому разворачиваем
 * вручную — иначе такой загрузчик отдаёт объект без render/template.
 */
function unwrap(module: Component | { default: Component }): Component {
  return typeof module === 'object' && module !== null && 'default' in module
    ? (module as { default: Component }).default
    : (module as Component);
}

/**
 * Подставляет в роутер мобильный или десктопный компонент страницы.
 *
 * Возвращается именно ЛЕНИВЫЙ загрузчик, а не компонент-обёртка с
 * `defineAsyncComponent` внутри. Разница принципиальная: функцию vue-router
 * считает асинхронным компонентом маршрута и ждёт её в `beforeResolve`, а
 * синхронную обёртку — нет. С обёрткой `router.isReady()` резолвился до того,
 * как чанк страницы приехал: заставка гасла на пустой фон (App.vue снимает её
 * ровно по `isReady`), а чанк вложенной страницы уходил в сеть только после
 * того, как отрисуется оболочка — два последовательных запроса вместо одного
 * параллельного.
 *
 * Плата за это — платформа выбирается в момент навигации. Живое переключение
 * на ресайзе даёт `watchPlatformSwitch`.
 */
export function platformPage(mobile: PageLoader, desktop: PageLoader): RouteComponentLoader {
  return () => (useIsDesktop().value ? desktop() : mobile()).then(unwrap);
}

/**
 * Перезагружает приложение, когда окно пересекает границу платформы.
 *
 * Разрешённый компонент маршрута vue-router кэширует в самой записи, поэтому
 * повторная навигация по тому же адресу вернёт уже загруженный вариант —
 * подменить его на лету, не трогая внутренности роутера, нельзя. Событие это
 * редкое (перетаскивание края окна на компьютере; на телефоне пересечь 1024 px
 * нечем), а перезагрузка на этом месте честнее полумеры, при которой широкое
 * окно продолжает показывать мобильную вёрстку до следующего клика по разделу.
 */
export function watchPlatformSwitch(router: Router): void {
  const isDesktop = useIsDesktop();

  watch(isDesktop, () => {
    // Адрес сохраняем: перезагрузка не должна выкидывать пользователя со
    // страницы, на которой он стоял.
    window.location.assign(router.currentRoute.value.fullPath);
  });
}
