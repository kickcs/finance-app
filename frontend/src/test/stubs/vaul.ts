/* eslint-disable vue/one-component-per-file -- набор заглушек одного пакета живёт одним файлом */
import { defineComponent, h, Teleport, type VNode } from 'vue';

/**
 * Заглушка vaul-vue для jsdom-тестов.
 *
 * Настоящая шторка закрывается через `Presence` из reka-ui, а тот на закрытии
 * читает `style.display` уже отсоединённого узла. jsdom отвечает на это
 * «Cannot read private member #values», и вся тестовая программа падает с
 * ненулевым кодом, хотя ни один assert не сломан.
 *
 * Заглушка сохраняет наблюдаемый контракт — содержимое телепортируется в body,
 * когда `open`, и исчезает, когда нет, — но не тянет анимацию присутствия.
 * Тесты страницы проверяют её собственную логику, а не переходы vaul.
 */
function renderSlot(slot?: () => VNode[]): VNode[] {
  return slot?.() ?? [];
}

const DrawerRoot = defineComponent({
  name: 'DrawerRootStub',
  props: {
    open: { type: Boolean, default: false },
    direction: { type: String, default: 'bottom' },
  },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () =>
      props.open ? h('div', { 'data-drawer-root': '' }, renderSlot(slots.default)) : null;
  },
});

const DrawerPortal = defineComponent({
  name: 'DrawerPortalStub',
  setup(_, { slots }) {
    return () => h(Teleport, { to: 'body' }, renderSlot(slots.default));
  },
});

function passthrough(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: true,
    setup(_, { slots }) {
      return () => h(tag, renderSlot(slots.default));
    },
  });
}

export const vaulStub = {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay: passthrough('DrawerOverlayStub'),
  DrawerContent: passthrough('DrawerContentStub'),
  DrawerHandle: passthrough('DrawerHandleStub'),
  DrawerTitle: passthrough('DrawerTitleStub', 'h2'),
  DrawerDescription: passthrough('DrawerDescriptionStub', 'p'),
  DrawerClose: passthrough('DrawerCloseStub', 'button'),
  DrawerTrigger: passthrough('DrawerTriggerStub', 'button'),
};
