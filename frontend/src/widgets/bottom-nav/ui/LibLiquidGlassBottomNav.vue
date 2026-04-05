<script setup lang="ts">
import { ref } from 'vue';
import { LiquidGlass, GlassMode } from '@wxperia/liquid-glass-vue';
import { UIcon, DiscoveryDot } from '@/shared/ui';
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
        <nav class="flex items-center justify-around w-full h-[60px]" aria-label="Навигация">
          <template v-for="item in navItems" :key="item.id">
            <!-- Add Button - Accent solid -->
            <div v-if="item.id === 'add'" class="relative">
              <button
                :aria-label="item.label"
                class="w-[46px] h-[46px] rounded-full flex items-center justify-center bg-gradient-to-br from-primary-hover to-primary text-white shadow-[0_4px_16px_rgba(79,70,229,0.45)] active:scale-[0.92] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                @click="handleAddClick"
              >
                <UIcon name="add" size="md" />
              </button>
              <DiscoveryDot :show="props.showAddDot" size="md" />
            </div>

            <!-- Nav Item -->
            <button
              v-else
              type="button"
              :aria-label="item.label"
              :aria-current="activeItem === item.id ? 'page' : undefined"
              class="relative flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
              @click="handleNavClick(item)"
            >
              <UIcon
                :name="item.icon"
                size="md"
                :filled="activeItem === item.id"
                :class="[
                  'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  activeItem === item.id ? 'text-white/90' : 'text-white/35',
                ]"
              />

              <!-- Active indicator - glow dot -->
              <div
                :class="[
                  'absolute bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  activeItem === item.id ? 'opacity-100 scale-100' : 'opacity-0 scale-0',
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
</style>
