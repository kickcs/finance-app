<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UIcon } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics/haptics';

const emit = defineEmits<{
  'add-click': [];
}>();

const route = useRoute();
const router = useRouter();

const navItems = [
  { id: 'home', icon: 'home', path: '/', label: 'Главная' },
  {
    id: 'analytics',
    icon: 'pie_chart',
    path: '/analytics',
    label: 'Аналитика',
  },
  { id: 'add', icon: 'add', path: '', label: 'Добавить' },
  { id: 'history', icon: 'history', path: '/history', label: 'История' },
  { id: 'profile', icon: 'person', path: '/profile', label: 'Профиль' },
];

const activeItem = computed(() => {
  return (
    navItems.find((item) => {
      if (item.path === '') return false;
      if (item.path === '/') return route.path === '/';
      return route.path.startsWith(item.path);
    })?.id || 'home'
  );
});

function handleAddClick() {
  haptics.tap();
  emit('add-click');
}

function handleNavClick(item: (typeof navItems)[0]) {
  if (item.path === '' || item.id === activeItem.value) return;
  haptics.tap();
  router.push(item.path);
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark px-4 pb-6 pt-2"
  >
    <div class="max-w-md mx-auto flex items-center justify-around">
      <template v-for="item in navItems" :key="item.id">
        <!-- Add Button - Clean flat square -->
        <button
          v-if="item.id === 'add'"
          :aria-label="item.label"
          class="w-10 h-10 rounded-lg flex items-center justify-center bg-primary text-white hover:bg-primary-hover active:scale-[0.92] shadow-sm active:shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          @click="handleAddClick"
        >
          <UIcon name="add" size="md" />
        </button>

        <!-- Nav Item -->
        <button
          v-else
          type="button"
          :aria-label="item.label"
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
