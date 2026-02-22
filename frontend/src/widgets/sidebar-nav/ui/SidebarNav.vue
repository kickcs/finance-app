<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { UIcon } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics/haptics';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { ThemeToggle } from '@/features/toggle-theme';
import { MAIN_NAV_ITEMS } from '@/shared/config/navigation';

defineProps<{
  userName?: string;
  greeting?: string;
  totalBalance?: number;
  currency?: string;
  isHidden?: boolean;
}>();

defineEmits<{
  'add-click': [];
  'toggle-hidden': [];
}>();

const route = useRoute();

const activeItem = computed(() => {
  return (
    MAIN_NAV_ITEMS.find((item) => {
      if (item.path === '/') return route.path === '/';
      return route.path.startsWith(item.path);
    })?.id || 'home'
  );
});

function handleNavClick(item: (typeof MAIN_NAV_ITEMS)[number]) {
  if (item.id === activeItem.value) return;
  haptics.tap();
}
</script>

<template>
  <aside
    aria-label="Навигационная панель"
    class="w-72 h-full flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark py-6 px-4"
  >
    <!-- User Profile & Theme -->
    <div class="flex items-center justify-between mb-8 px-2">
      <RouterLink
        to="/profile"
        class="flex items-center gap-3 group"
        aria-label="Перейти в профиль"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-primary-hover shadow-sm group-hover:shadow-md group-hover:scale-105 transition-[transform,box-shadow] duration-200 text-white font-bold text-lg shrink-0"
        >
          {{ userName ? userName[0].toUpperCase() : 'O' }}
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
            {{ greeting || 'Добро пожаловать' }}
          </span>
          <span
            class="font-bold text-base text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors truncate"
          >
            {{ userName || 'Ouro' }}
          </span>
        </div>
      </RouterLink>
      <ThemeToggle />
    </div>

    <!-- Balance Card -->
    <div class="mb-8 px-2">
      <div
        class="p-4 rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow duration-300"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span
            class="text-caption-sm uppercase font-semibold text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Общий баланс
          </span>
          <button
            :aria-label="isHidden ? 'Показать баланс' : 'Скрыть баланс'"
            :aria-pressed="!!isHidden"
            class="text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors p-1 -mr-1 rounded-md hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark"
            @click="$emit('toggle-hidden')"
          >
            <UIcon :name="isHidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>
        <div
          class="font-bold text-2xl text-text-primary-light dark:text-text-primary-dark tracking-tight"
        >
          {{
            formatMasked(totalBalance || 0, currency || 'USD', isHidden ?? false, COMPACT_FORMAT)
          }}
        </div>
      </div>
    </div>

    <!-- Navigation Links -->
    <nav class="flex-1 space-y-1.5 overflow-y-auto">
      <RouterLink
        v-for="item in MAIN_NAV_ITEMS"
        :key="item.id"
        :to="item.path"
        :aria-current="activeItem === item.id ? 'page' : undefined"
        class="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-colors duration-200 no-underline"
        :class="
          activeItem === item.id
            ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
            : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark'
        "
        @click="handleNavClick(item)"
      >
        <UIcon
          :name="item.icon"
          size="md"
          :filled="activeItem === item.id"
          :class="
            activeItem === item.id
              ? 'text-primary'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        />
        <span class="text-[15px]">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Bottom Action -->
    <div class="mt-auto pt-6 px-2 shrink-0">
      <button
        aria-label="Добавить операцию"
        class="w-full py-4 rounded-xl bg-primary text-white font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-[transform,box-shadow] duration-200 flex items-center justify-center gap-2"
        @click="$emit('add-click')"
      >
        <UIcon name="add" size="sm" />
        <span>Добавить операцию</span>
      </button>
    </div>
  </aside>
</template>
