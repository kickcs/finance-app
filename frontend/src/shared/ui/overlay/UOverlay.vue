<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
  DrawerDescription,
} from 'vaul-vue';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui';
import { useIsDesktop } from '@/shared/lib/platform/useIsDesktop';
import { cn } from '@/shared/lib/utils';
import OverlayHeader from './OverlayHeader.vue';

/**
 * Единая обвязка «нижняя шторка на мобиле / правая панель или диалог на
 * десктопе». Раньше эта разводка — direction, оверлей, тернарник классов,
 * ручка — была продублирована в 13 файлах с разъехавшимися высотами
 * (70/80/85/90dvh). Теперь она в одном месте.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    desktop?: 'panel' | 'dialog';
    maxHeight?: string;
    /**
     * Шторка для текстового ввода: высота фиксирована (top/bottom), не зависит
     * от контента и клавиатуры — вместо геометрии, которая гонится за
     * visualViewport на каждое нажатие (см. удалённый useDrawerKeyboard).
     */
    fill?: boolean;
  }>(),
  { title: undefined, desktop: 'panel', maxHeight: '85dvh', fill: false },
);

const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const isDesktop = useIsDesktop();
const isPanel = computed(() => props.desktop === 'panel');

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);

// Содержимое отдаётся наружу ради порталов: календарь в портале на body тап по
// себе отдаёт шторке как клик снаружи, и она закрывается вместе с выбором даты.
const dialogContentRef = ref<{ $el?: HTMLElement } | null>(null);
// `$el` компонента, у которого в корне фрагмент, — якорный комментарий, а
// Teleport в комментарий падает: наружу отдаём только настоящий элемент.
defineExpose({
  contentEl: computed<HTMLElement | null>(() => {
    const el = dialogContentRef.value?.$el ?? drawerContentRef.value?.$el;
    return el instanceof HTMLElement ? el : null;
  }),
});

const OVERLAY_CLASS = 'fixed inset-0 z-50 bg-black/40';
const BODY_CLASS = 'flex-1 overflow-y-auto px-5 py-4';
const SURFACE_CLASS = 'flex flex-col bg-card-light dark:bg-card-dark';
</script>

<template>
  <!-- Десктоп: правая панель или центрированный диалог -->
  <DialogRoot v-if="isDesktop" v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="OVERLAY_CLASS" />
      <DialogContent
        ref="dialogContentRef"
        :data-testid="isPanel ? 'overlay-panel' : 'overlay-dialog'"
        :class="
          cn(
            'fixed z-50',
            SURFACE_CLASS,
            isPanel
              ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
              : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-[560px] max-h-[85dvh] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-lg',
          )
        "
      >
        <OverlayHeader :title="title" :title-as="DialogTitle" @close="open = false">
          <template #action><slot name="action" /></template>
        </OverlayHeader>
        <!-- sr-only: DialogContentImpl требует Description, иначе aria-describedby
             ссылается в никуда и в консоль падает предупреждение reka-ui -->
        <DialogDescription class="sr-only">{{ title ?? 'Диалоговое окно' }}</DialogDescription>
        <div :class="BODY_CLASS"><slot /></div>
        <div v-if="$slots.footer" class="shrink-0 px-5 py-4"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Мобильная: нижняя шторка -->
  <DrawerRoot v-else v-model:open="open" direction="bottom">
    <DrawerPortal>
      <DrawerOverlay :class="OVERLAY_CLASS" />
      <!--
        fill: top и bottom зафиксированы (высота не зависит ни от контента, ни
        от клавиатуры — раньше этим ведала геометрия из useDrawerKeyboard, она
        удалена вместе с хуком). Иначе предел высоты приходит через
        CSS-переменную --overlay-max-h, а не напрямую в style.maxHeight, чтобы
        класс max-h-[var(--overlay-max-h)] был единственным источником истины.
      -->
      <DrawerContent
        ref="drawerContentRef"
        data-testid="overlay-sheet"
        :style="
          fill
            ? { top: 'calc(var(--safe-area-inset-top) + 0.5rem)' }
            : { '--overlay-max-h': maxHeight }
        "
        :class="
          cn(
            'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl',
            !fill && 'max-h-[var(--overlay-max-h)]',
            SURFACE_CLASS,
          )
        "
      >
        <!-- Именно DrawerHandle, а не div: у него своя увеличенная зона
             касания, попасть пальцем в полоску высотой 4px иначе трудно. -->
        <DrawerHandle
          class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border-light dark:bg-border-dark"
        />
        <OverlayHeader :title="title" :title-as="DrawerTitle" @close="open = false">
          <template #action><slot name="action" /></template>
        </OverlayHeader>
        <!-- sr-only: DrawerContent рендерит тот же reka-ui DialogContentImpl,
             что и десктопный DialogContent, — то же требование Description -->
        <DrawerDescription class="sr-only">{{ title ?? 'Диалоговое окно' }}</DrawerDescription>
        <!-- Без подвала нижним краем содержимого становится само тело — тогда
             отступ под жестовую полосу нужен ему, иначе последняя строка
             списка уходит под home indicator. -->
        <div
          :class="cn(BODY_CLASS, !$slots.footer && 'pb-[max(env(safe-area-inset-bottom),1rem)]')"
          data-vaul-no-drag
        >
          <slot />
        </div>
        <!-- `max(...)` вместо голого env(): на устройствах без жестовой полосы
             (и в браузере на компьютере) значение равно нулю, и кнопка
             прилипала бы вплотную к нижнему краю шторки. -->
        <div
          v-if="$slots.footer"
          class="shrink-0 border-t border-border-light dark:border-border-dark px-5 pt-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        >
          <slot name="footer" />
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
