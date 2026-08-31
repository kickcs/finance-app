<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue';
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { transitionName, finishPageTransition } from '@/app/router';
import BackgroundRouteView from './BackgroundRouteView.vue';

const props = defineProps<{
  /**
   * Включает рендер `meta.desktopOverlay`-маршрутов поверх фонового —
   * передаёт только `DesktopLayout`. На мобиле такие маршруты остаются
   * полноэкранными (как раньше), поэтому `MobileLayout` этот проп не задаёт.
   */
  supportsOverlayRoutes?: boolean;
}>();

const isDemo = inject<Ref<boolean>>('isDemo', ref(false));

const route = useRoute();
const router = useRouter();

const isOverlayRoute = computed(
  () => !!props.supportsOverlayRoutes && route.meta.desktopOverlay === true,
);

/**
 * `backgroundPath` — последний маршрут, который не был оверлеем, целиком
 * (`fullPath`, вместе с query). Пока маршрут-оверлей активен, значение не
 * меняется. Используется только как вход в `router.resolve()` ниже — сам по
 * себе `:key` компонента на нём не вешаем (см. `backgroundLocation.path`).
 *
 * Раньше фон и активный маршрут рисовались в двух РАЗНЫХ `RouterView`: при
 * открытии оверлея реальный маршрут утекал в позицию оверлея, а фон
 * пересоздавался с нуля во второй, до этого не существовавшей позиции — терял
 * скролл и локальное состояние на каждое открытие/закрытие.
 *
 * На мобиле `supportsOverlayRoutes` не передан, `isOverlayRoute` всегда
 * `false` — `backgroundPath` просто следует за реальным маршрутом, как и
 * раньше, включая маршруты с `meta.desktopOverlay` (там флаг игнорируется, и
 * такой маршрут остаётся полноэкранным).
 */
const backgroundPath = ref<string>('/');

watch(
  () => route.fullPath,
  () => {
    if (!isOverlayRoute.value) backgroundPath.value = route.fullPath;
  },
  { immediate: true },
);

// `router.resolve` — чистое вычисление, никакой навигации не запускает: фон
// не проходит через beforeEach/guards ещё раз.
const backgroundLocation = computed<RouteLocationNormalizedLoaded>(() => {
  const resolved = router.resolve(backgroundPath.value);
  return { ...resolved, name: resolved.name ?? undefined } as RouteLocationNormalizedLoaded;
});
</script>

<template>
  <div
    :class="[
      'w-full flex overflow-hidden bg-background-light dark:bg-background-dark',
      isDemo ? 'flex-1 min-h-0' : 'h-dvh',
    ]"
  >
    <!-- Skip navigation link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      Перейти к содержимому
    </a>

    <slot name="nav-side" />

    <div
      id="main-content"
      class="flex-1 flex flex-col min-w-0 h-full relative bg-background-light dark:bg-background-dark"
    >
      <div class="flex-1 relative overflow-hidden flex flex-col">
        <!-- Фон: единственная позиция контента, `:key` — только путь без
             query (`backgroundLocation.path`). Навигация на фоновом маршруте,
             меняющая лишь query (`router.replace({ query })` — так выбор
             счёта пишет `?id=` в AccountsDesktopPage, а выбор человека в
             useDebtsPage), не меняет `:key` и поэтому не размонтирует
             страницу; ключ по `fullPath` размонтировал бы её на каждый такой
             replace. Между входом и выходом из оверлея `:key` тоже не
             меняется — инстанс страницы под модалкой переживает её открытие и
             закрытие. -->
        <BackgroundRouteView
          v-slot="{ component: BackgroundComponent }"
          :location="backgroundLocation"
        >
          <div
            v-if="transitionName === 'none'"
            :key="backgroundLocation.path"
            class="w-full h-full flex flex-col"
          >
            <component :is="BackgroundComponent" />
          </div>
          <Transition v-else :name="transitionName" @after-enter="finishPageTransition">
            <div
              :key="backgroundLocation.path"
              class="absolute inset-0 w-full h-full flex flex-col"
            >
              <component :is="BackgroundComponent" />
            </div>
          </Transition>
        </BackgroundRouteView>

        <!-- Оверлейная страница поверх фона — только на десктопе и только на
             маршруте-оверлее. Отдельный `RouterView` без подмены `:route`,
             поэтому `useRoute()` внутри неё (например, `route.query.type` в
             форме новой операции) видит реальный текущий маршрут, а не
             подменённый фоновый. -->
        <RouterView v-if="isOverlayRoute" v-slot="{ Component: OverlayComponent }">
          <div class="absolute inset-0 w-full h-full flex flex-col">
            <component :is="OverlayComponent" />
          </div>
        </RouterView>
      </div>

      <slot name="nav-bottom" />
    </div>
  </div>
</template>
