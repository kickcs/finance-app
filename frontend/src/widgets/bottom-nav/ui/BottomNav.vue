<script setup lang="ts">
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
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark px-4 pb-6 pt-2"
  >
    <div class="max-w-md mx-auto flex items-center justify-around">
      <template v-for="item in navItems" :key="item.id">
        <!-- Add Button - Clean flat square -->
        <div v-if="item.id === 'add'" class="relative">
          <button
            :aria-label="item.label"
            class="w-10 h-10 rounded-lg flex items-center justify-center bg-primary text-white hover:bg-primary-hover active:scale-[0.92] shadow-sm active:shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
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
          class="relative flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          @click="handleNavClick(item)"
        >
          <UIcon
            :name="item.icon"
            size="md"
            :filled="activeItem === item.id"
            :class="[
              'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              activeItem === item.id
                ? 'text-primary -translate-y-1 scale-110'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark',
            ]"
          />

          <!-- Active indicator - simple line -->
          <div
            :class="[
              'absolute bottom-1 w-4 h-0.5 rounded-full bg-primary transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              activeItem === item.id
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-50 translate-y-1',
            ]"
          />
        </button>
      </template>
    </div>
  </nav>
</template>
