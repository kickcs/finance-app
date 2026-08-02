<script setup lang="ts">
import { provide, shallowReactive, watchEffect } from 'vue';
import { RouterView, routeLocationKey, type RouteLocationNormalizedLoaded } from 'vue-router';

const props = defineProps<{ location: RouteLocationNormalizedLoaded }>();

/**
 * `RouterView` при переданном пропе `:route` переопределяет только
 * `routerViewLocationKey` (используется для расчёта глубины и подбора
 * matched-компонента) — а `useRoute()` внутри отрисованной страницы делает
 * `inject(routeLocationKey)` напрямую, и этот провайдер `RouterView` не
 * трогает (vue-router 4.6.4: routeLocationKey ставится один раз в
 * `app.provide` при установке роутера, `RouterView` его не переопределяет).
 *
 * Без собственного provide фоновая страница видела бы глобальный активный
 * маршрут (маршрут-оверлей), а не переданный `location` — так, например,
 * `AccountsDesktopPage` терял бы `?id=` из query, пока поверх открыта
 * «Новая операция».
 */
const backgroundRoute = shallowReactive<RouteLocationNormalizedLoaded>({ ...props.location });
watchEffect(() => {
  Object.assign(backgroundRoute, props.location);
});
provide(routeLocationKey, backgroundRoute);
</script>

<template>
  <RouterView v-slot="{ Component }" :route="location">
    <slot :component="Component" />
  </RouterView>
</template>
