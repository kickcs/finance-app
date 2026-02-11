<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { UIcon } from '@/shared/ui'

defineEmits<{
  'add-click': []
}>()

const route = useRoute()

const navItems = [
  { id: 'home', icon: 'home', path: '/', label: 'Главная' },
  { id: 'analytics', icon: 'pie_chart', path: '/analytics', label: 'Аналитика' },
  { id: 'add', icon: 'add', path: '', label: 'Добавить' },
  { id: 'history', icon: 'history', path: '/history', label: 'История' },
  { id: 'profile', icon: 'person', path: '/profile', label: 'Профиль' },
]

const activeItem = computed(() => {
  return navItems.find(item => {
    if (item.path === '') return false
    if (item.path === '/') return route.path === '/'
    return route.path.startsWith(item.path)
  })?.id || 'home'
})
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-40
           bg-card-light dark:bg-card-dark
           border-t border-border-light dark:border-border-dark
           px-4 pb-6 pt-2"
  >
    <div class="max-w-md mx-auto flex items-center justify-around">
      <template v-for="item in navItems" :key="item.id">
        <!-- Add Button - Clean flat square -->
        <button
          v-if="item.id === 'add'"
          :aria-label="item.label"
          class="w-10 h-10 rounded-lg
                 flex items-center justify-center
                 bg-primary text-white
                 hover:bg-primary-hover
                 active:opacity-80
                 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none
                 transition-all duration-150"
          @click="$emit('add-click')"
        >
          <UIcon name="add" size="md" />
        </button>

        <!-- Nav Item -->
        <router-link
          v-else
          :to="item.path"
          :aria-label="item.label"
          class="relative flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-all duration-150
                 active:opacity-80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <UIcon
            :name="item.icon"
            size="md"
            :filled="activeItem === item.id"
            :class="[
              'transition-colors duration-150',
              activeItem === item.id
                ? 'text-primary'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark'
            ]"
          />

          <!-- Active indicator - simple line -->
          <div
            :class="[
              'absolute bottom-0.5 w-4 h-0.5 rounded-full bg-primary transition-all duration-150',
              activeItem === item.id ? 'opacity-100' : 'opacity-0'
            ]"
          />
        </router-link>
      </template>
    </div>
  </nav>
</template>
