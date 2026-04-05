<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import { LiquidGlass, GlassMode } from '@wxperia/liquid-glass-vue';
import { UIcon, DiscoveryDot } from '@/shared/ui';
import { useResizeObserver, useTimeoutFn } from '@vueuse/core';
import { useBottomNav } from '../lib/useBottomNav';

const props = withDefaults(
  defineProps<{
    showAddDot?: boolean;
  }>(),
  { showAddDot: false },
);

const emit = defineEmits<{
  'add-click': [];
  'add-dot-dismiss': [];
}>();

const { navItems, activeItem, handleAddClick, handleNavClick } = useBottomNav(emit);

const containerRef = ref<HTMLDivElement>();
const navRef = ref<HTMLElement | null>(null);

// Custom indicator positioning using offsetLeft/offsetWidth instead of
// getBoundingClientRect(). LiquidGlass applies scale transforms to parent
// elements — getBoundingClientRect() returns scaled viewport coords while
// CSS position:absolute uses unscaled local coords, causing mismatch.
const chipRefs = new Map<string, HTMLElement>();
const indicatorStyle = ref<Record<string, string | number>>({ opacity: 0 });

function setChipRef(id: string, el: HTMLElement | null) {
  if (el) {
    if (chipRefs.get(id) !== el) chipRefs.set(id, el);
  } else {
    chipRefs.delete(id);
  }
}

function updateIndicator() {
  const id = activeItem.value;
  if (!id) {
    indicatorStyle.value = { opacity: 0 };
    return;
  }
  const el = chipRefs.get(id);
  if (!el) {
    indicatorStyle.value = { opacity: 0 };
    return;
  }
  indicatorStyle.value = {
    left: `${el.offsetLeft}px`,
    top: `${el.offsetTop}px`,
    width: `${el.offsetWidth}px`,
    height: `${el.offsetHeight}px`,
    opacity: 1,
  };
}

watch(activeItem, () => nextTick(updateIndicator));
useResizeObserver(navRef, () => nextTick(updateIndicator));

const { start: scheduleSettle } = useTimeoutFn(updateIndicator, 300, { immediate: false });
onMounted(() => {
  nextTick(updateIndicator);
  scheduleSettle();
});
</script>

<template>
  <!--
    LiquidGlass always applies transform: translate(-50%, -50%) from center.
    We counter this by placing it inside a positioned wrapper where
    top:50% + left:50% makes the translate center it correctly.
  -->
  <div ref="containerRef" class="fixed bottom-4 left-4 right-4 z-40 h-[60px]">
    <div class="relative w-full h-full">
      <LiquidGlass
        :mouse-container="containerRef"
        :displacement-scale="80"
        :blur-amount="0.08"
        :saturation="160"
        :aberration-intensity="3"
        :corner-radius="30"
        :elasticity="0.2"
        :over-light="false"
        :mode="GlassMode.prominent"
        padding="0 12px"
        :style="{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
        }"
      >
        <nav
          ref="navRef"
          class="relative flex items-center justify-around w-full h-[60px]"
          aria-label="Навигация"
        >
          <!-- Sliding glass indicator -->
          <span
            class="absolute rounded-2xl pointer-events-none z-0 sliding-indicator bg-black/[0.12] dark:bg-white/[0.14] backdrop-blur-sm"
            :style="indicatorStyle"
          />

          <template v-for="item in navItems" :key="item.id">
            <!-- Add Button -->
            <div v-if="item.id === 'add'" class="relative z-10">
              <button
                :aria-label="item.label"
                class="w-[46px] h-[46px] rounded-full flex items-center justify-center bg-gradient-to-br from-primary-hover to-primary text-white shadow-[0_4px_16px_rgba(79,70,229,0.45)] active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                @click="handleAddClick"
              >
                <UIcon name="add" size="lg" />
              </button>
              <DiscoveryDot :show="props.showAddDot" size="md" />
            </div>

            <!-- Nav Item -->
            <button
              v-else
              :ref="(el) => setChipRef(item.id, el as HTMLElement)"
              type="button"
              :aria-label="item.label"
              :aria-current="activeItem === item.id ? 'page' : undefined"
              class="relative z-10 flex items-center justify-center w-12 h-12 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
              @click="handleNavClick(item)"
            >
              <UIcon
                :name="item.icon"
                size="lg"
                :filled="activeItem === item.id"
                :class="[
                  'transition-colors duration-300 nav-icon',
                  activeItem === item.id
                    ? 'text-black dark:text-white'
                    : 'text-black/55 dark:text-white/60',
                ]"
              />
            </button>
          </template>
        </nav>
      </LiquidGlass>
    </div>
  </div>
</template>

<style scoped>
/* @wxperia/liquid-glass-vue@1.0.9: library uses inline-flex on .glass and
   doesn't stretch the slot wrapper. Override to fill full navbar width. */
:deep(.glass) {
  display: flex !important;
  width: 100% !important;
}

:deep(.glass > div) {
  width: 100% !important;
}

/* Library sets transition: all 0.2s on glass container and root elements.
   This causes width/height to animate on resize, which feeds stale coords
   to the ResizeObserver. Scope to .glass internals only — not nav content. */
:deep(.glass),
:deep(.glass *) {
  transition-property: transform, opacity, backdrop-filter, filter !important;
}

/* Bolder icons for glass navbar readability */
.nav-icon :deep(svg) {
  stroke-width: 2.5;
}

/* Smooth slide for the active indicator */
.sliding-indicator {
  transition-property: left, top, width, height, opacity !important;
  transition-duration: 300ms, 300ms, 300ms, 300ms, 150ms;
  transition-timing-function: ease-out;
}
</style>
